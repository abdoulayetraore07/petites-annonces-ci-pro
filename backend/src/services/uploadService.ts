// backend/src/services/uploadService.ts
// SERVICE UPLOAD RÉVOLUTIONNAIRE - CLOUDINARY + OPTIMISATIONS
// Gestion images/vidéos avec compression, formats WebP/AVIF, CDN global

import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import sharp from 'sharp';
import { createHash } from 'crypto';
import path from 'path';

// ==============================================
// CONFIGURATION CLOUDINARY
// ==============================================

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

// ==============================================
// INTERFACES ET TYPES
// ==============================================

interface UploadOptions {
  folder?: string;
  quality?: number;
  format?: 'webp' | 'avif' | 'jpeg' | 'png';
  maxWidth?: number;
  maxHeight?: number;
  watermark?: boolean;
  compress?: boolean;
}

interface UploadResult {
  url: string;
  secureUrl: string;
  publicId: string;
  width: number;
  height: number;
  format: string;
  size: number;
  signature: string;
  etag: string;
  placeholder?: string; // Base64 placeholder
  variants?: {
    thumbnail?: string;
    medium?: string;
    large?: string;
  };
}

interface MultiUploadResult {
  success: UploadResult[];
  errors: { file: string; error: string }[];
  summary: {
    total: number;
    uploaded: number;
    failed: number;
    totalSize: number;
  };
}

// ==============================================
// CLASSE UPLOADSERVICE
// ==============================================

export class UploadService {
  private static readonly DEFAULT_FOLDER = process.env.CLOUDINARY_FOLDER || 'petites-annonces-ci';
  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp', 'avif', 'gif'];
  private static readonly COMPRESSION_QUALITY = 85;
  
  // ==============================================
  // UPLOAD IMAGE UNIQUE
  // ==============================================
  
  static async uploadImage(
    file: Buffer | string,
    options: UploadOptions = {}
  ): Promise<UploadResult> {
    try {
      const {
        folder = this.DEFAULT_FOLDER,
        quality = this.COMPRESSION_QUALITY,
        format = 'webp',
        maxWidth = 1920,
        maxHeight = 1080,
        watermark = false,
        compress = true
      } = options;
      
      // Validation taille fichier
      if (Buffer.isBuffer(file) && file.length > this.MAX_FILE_SIZE) {
        throw new Error(`Fichier trop volumineux (max ${this.MAX_FILE_SIZE / 1024 / 1024}MB)`);
      }
      
      // Optimisation image avec Sharp
      let optimizedBuffer: Buffer;
      
      if (Buffer.isBuffer(file)) {
        optimizedBuffer = await this.optimizeImage(file, {
          format,
          quality,
          maxWidth,
          maxHeight,
          compress
        });
      } else {
        // Si c'est une URL ou un chemin
        optimizedBuffer = file as any;
      }
      
      // Configuration upload Cloudinary
      const uploadConfig = {
        folder,
        quality: quality,
        format: format,
        resource_type: 'image' as const,
        transformation: [
          { width: maxWidth, height: maxHeight, crop: 'limit' },
          { quality: `${quality}:420`, format: format },
          ...(watermark ? [{
            overlay: 'petites_annonces_ci_watermark',
            opacity: 20,
            gravity: 'south_east',
            width: 100
          }] : [])
        ],
        eager: [
          // Générer automatiquement les variants
          { width: 150, height: 150, crop: 'thumb', format: 'webp', quality: 80 }, // Thumbnail
          { width: 500, height: 300, crop: 'limit', format: 'webp', quality: 85 }, // Medium
          { width: 1200, height: 800, crop: 'limit', format: 'webp', quality: 90 } // Large
        ],
        use_filename: true,
        unique_filename: true,
        overwrite: false
      };
      
      // Upload vers Cloudinary
      const result = await cloudinary.uploader.upload(
        Buffer.isBuffer(optimizedBuffer) 
          ? `data:image/${format};base64,${optimizedBuffer.toString('base64')}`
          : optimizedBuffer as string,
        uploadConfig
      );
      
      // Générer placeholder base64
      const placeholder = await this.generatePlaceholder(optimizedBuffer);
      
      return {
        url: result.url,
        secureUrl: result.secure_url,
        publicId: result.public_id,
        width: result.width,
        height: result.height,
        format: result.format,
        size: result.bytes,
        signature: result.signature,
        etag: result.etag,
        placeholder,
        variants: {
          thumbnail: result.eager?.[0]?.secure_url,
          medium: result.eager?.[1]?.secure_url,
          large: result.eager?.[2]?.secure_url
        }
      };
      
    } catch (error) {
      console.error('❌ Erreur upload image:', error);
      throw new Error(`Erreur upload: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }
  
  // ==============================================
  // UPLOAD MULTIPLE IMAGES
  // ==============================================
  
  static async uploadMultipleImages(
    files: Buffer[],
    options: UploadOptions = {}
  ): Promise<MultiUploadResult> {
    const results: UploadResult[] = [];
    const errors: { file: string; error: string }[] = [];
    let totalSize = 0;
    
    console.log(`🔄 Upload de ${files.length} images...`);
    
    // Upload en parallèle avec limite de concurrence
    const uploadPromises = files.map(async (file, index) => {
      try {
        const result = await this.uploadImage(file, {
          ...options,
          folder: `${options.folder || this.DEFAULT_FOLDER}/batch_${Date.now()}`
        });
        
        results.push(result);
        totalSize += result.size;
        
        console.log(`✅ Image ${index + 1}/${files.length} uploadée`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
        errors.push({
          file: `image_${index + 1}`,
          error: errorMessage
        });
        console.error(`❌ Échec upload image ${index + 1}:`, errorMessage);
      }
    });
    
    // Attendre tous les uploads
    await Promise.all(uploadPromises);
    
    return {
      success: results,
      errors,
      summary: {
        total: files.length,
        uploaded: results.length,
        failed: errors.length,
        totalSize
      }
    };
  }
  
  // ==============================================
  // OPTIMISATION IMAGES AVEC SHARP
  // ==============================================
  
  private static async optimizeImage(
    buffer: Buffer,
    options: {
      format: string;
      quality: number;
      maxWidth: number;
      maxHeight: number;
      compress: boolean;
    }
  ): Promise<Buffer> {
    try {
      let pipeline = sharp(buffer);
      
      // Redimensionnement si nécessaire
      pipeline = pipeline.resize(options.maxWidth, options.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
      
      // Optimisation selon le format
      switch (options.format) {
        case 'webp':
          pipeline = pipeline.webp({ 
            quality: options.quality,
            effort: 6 // Maximum effort pour meilleure compression
          });
          break;
          
        case 'avif':
          pipeline = pipeline.avif({ 
            quality: options.quality,
            effort: 9 // Maximum effort
          });
          break;
          
        case 'jpeg':
          pipeline = pipeline.jpeg({ 
            quality: options.quality,
            progressive: true,
            mozjpeg: true
          });
          break;
          
        case 'png':
          pipeline = pipeline.png({ 
            quality: options.quality,
            compressionLevel: 9,
            progressive: true
          });
          break;
          
        default:
          pipeline = pipeline.webp({ quality: options.quality });
      }
      
      return await pipeline.toBuffer();
      
    } catch (error) {
      console.error('❌ Erreur optimisation image:', error);
      throw error;
    }
  }
  
  // ==============================================
  // GÉNÉRATION PLACEHOLDER BASE64
  // ==============================================
  
  private static async generatePlaceholder(buffer: Buffer | string): Promise<string> {
    try {
      if (typeof buffer === 'string') {
        return ''; // Skip pour les URLs
      }
      
      const placeholder = await sharp(buffer)
        .resize(20, 20, { fit: 'inside' })
        .blur(2)
        .webp({ quality: 50 })
        .toBuffer();
        
      return `data:image/webp;base64,${placeholder.toString('base64')}`;
    } catch (error) {
      console.warn('⚠️ Impossible de générer placeholder:', error);
      return '';
    }
  }
  
  // ==============================================
  // SUPPRESSION IMAGES
  // ==============================================
  
  static async deleteImage(publicId: string): Promise<boolean> {
    try {
      const result = await cloudinary.uploader.destroy(publicId);
      return result.result === 'ok';
    } catch (error) {
      console.error('❌ Erreur suppression image:', error);
      return false;
    }
  }
  
  static async deleteMultipleImages(publicIds: string[]): Promise<{
    deleted: string[];
    failed: string[];
  }> {
    const deleted: string[] = [];
    const failed: string[] = [];
    
    for (const publicId of publicIds) {
      const success = await this.deleteImage(publicId);
      if (success) {
        deleted.push(publicId);
      } else {
        failed.push(publicId);
      }
    }
    
    return { deleted, failed };
  }
  
  // ==============================================
  // UTILITAIRES
  // ==============================================
  
  static validateImageFormat(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase().substring(1);
    return this.ALLOWED_FORMATS.includes(ext);
  }
  
  static generateImageHash(buffer: Buffer): string {
    return createHash('md5').update(buffer).digest('hex');
  }
  
  static getImageInfo(publicId: string): Promise<any> {
    return cloudinary.api.resource(publicId);
  }
}

// ==============================================
// SERVICE EMAIL RÉVOLUTIONNAIRE
// ==============================================

import nodemailer from 'nodemailer';
import { createTransport } from 'nodemailer';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private static transporter = createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
  
  // ==============================================
  // ENVOI EMAIL GÉNÉRIQUE
  // ==============================================
  
  static async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || '"Petites Annonces CI" <noreply@petites-annonces-ci.com>',
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.htmlToText(options.html),
        attachments: options.attachments
      };
      
      await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email envoyé à: ${mailOptions.to}`);
      return true;
      
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      return false;
    }
  }
  
  // ==============================================
  // TEMPLATES EMAIL CÔTE D'IVOIRE
  // ==============================================
  
  static getWelcomeTemplate(firstName: string): EmailTemplate {
    return {
      subject: '🎉 Bienvenue sur Petites Annonces CI !',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1>🇨🇮 Bienvenue ${firstName} !</h1>
            <p>La plateforme #1 des petites annonces en Côte d'Ivoire</p>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2>🚀 Votre compte est activé !</h2>
            <p>Félicitations ! Vous pouvez maintenant :</p>
            
            <ul style="color: #28a745;">
              <li>📢 Publier vos annonces gratuitement</li>
              <li>💬 Contacter les vendeurs directement</li>
              <li>⭐ Sauvegarder vos annonces favorites</li>
              <li>📱 Recevoir des alertes personnalisées</li>
            </ul>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}" 
                 style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">
                🏠 Accéder au site
              </a>
            </div>
            
            <p style="color: #666; font-size: 14px;">
              Besoin d'aide ? Contactez-nous à support@petites-annonces-ci.com
            </p>
          </div>
        </div>
      `,
      text: `Bienvenue ${firstName} sur Petites Annonces CI ! Votre compte est activé.`
    };
  }
  
  static getVerificationTemplate(firstName: string, verificationCode: string): EmailTemplate {
    return {
      subject: '🔐 Vérifiez votre compte - Petites Annonces CI',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #007bff; color: white; padding: 20px; text-align: center;">
            <h1>🔐 Vérification de compte</h1>
          </div>
          
          <div style="padding: 20px;">
            <p>Bonjour ${firstName},</p>
            <p>Voici votre code de vérification :</p>
            
            <div style="text-align: center; margin: 30px 0;">
              <span style="font-size: 32px; font-weight: bold; color: #007bff; letter-spacing: 5px; 
                           background: #f8f9fa; padding: 20px; border-radius: 10px; display: inline-block;">
                ${verificationCode}
              </span>
            </div>
            
            <p style="color: #dc3545; font-weight: bold;">
              ⏰ Ce code expire dans 15 minutes
            </p>
          </div>
        </div>
      `,
      text: `Votre code de vérification: ${verificationCode}`
    };
  }
  
  static getNewMessageTemplate(senderName: string, annonceTitle: string, messageContent: string): EmailTemplate {
    return {
      subject: `💬 Nouveau message pour "${annonceTitle}"`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #28a745; color: white; padding: 20px;">
            <h1>💬 Nouveau message reçu</h1>
          </div>
          
          <div style="padding: 20px;">
            <p><strong>${senderName}</strong> vous a envoyé un message concernant :</p>
            <h3 style="color: #007bff;">"${annonceTitle}"</h3>
            
            <div style="background: #f8f9fa; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0;">
              <p style="margin: 0; font-style: italic;">"${messageContent}"</p>
            </div>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${process.env.FRONTEND_URL}/messages" 
                 style="background: #28a745; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px;">
                📱 Répondre maintenant
              </a>
            </div>
          </div>
        </div>
      `,
      text: `Nouveau message de ${senderName} pour "${annonceTitle}": ${messageContent}`
    };
  }
  
  // ==============================================
  // UTILITAIRES
  // ==============================================
  
  private static htmlToText(html: string): string {
    return html
      .replace(/<[^>]*>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .trim();
  }
}

// ==============================================
// SERVICE SMS CÔTE D'IVOIRE
// ==============================================

interface SMSOptions {
  to: string | string[];
  message: string;
  sender?: string;
}

export class SMSService {
  private static readonly ORANGE_CI_BASE_URL = 'https://api.orange.com/smsmessaging/v1';
  private static readonly MAX_SMS_LENGTH = 160;
  
  // ==============================================
  // ENVOI SMS VIA ORANGE CI
  // ==============================================
  
  static async sendSMS(options: SMSOptions): Promise<boolean> {
    try {
      const { to, message, sender = 'PetitesCI' } = options;
      const recipients = Array.isArray(to) ? to : [to];
      
      // Normaliser les numéros ivoiriens
      const normalizedRecipients = recipients.map(phone => this.normalizeIvoirianPhone(phone));
      
      // Orange Money API (exemple - à adapter selon la vraie API)
      const response = await fetch(`${this.ORANGE_CI_BASE_URL}/outbound/2250/requests`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${await this.getOrangeAccessToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          outboundSMSMessageRequest: {
            address: normalizedRecipients.map(phone => `tel:${phone}`),
            senderAddress: `tel:${sender}`,
            outboundSMSTextMessage: {
              message: message.substring(0, this.MAX_SMS_LENGTH)
            }
          }
        })
      });
      
      const result = await response.json();
      console.log(`✅ SMS envoyé à ${normalizedRecipients.length} destinataire(s)`);
      return response.ok;
      
    } catch (error) {
      console.error('❌ Erreur envoi SMS:', error);
      return false;
    }
  }
  
  // ==============================================
  // TEMPLATES SMS CÔTE D'IVOIRE
  // ==============================================
  
  static getVerificationSMS(code: string): string {
    return `🔐 Petites Annonces CI\nCode de vérification: ${code}\nValide 15min`;
  }
  
  static getNewMessageSMS(senderName: string, annonceTitle: string): string {
    return `💬 Nouveau message de ${senderName} pour "${annonceTitle}". Répondez sur petites-annonces-ci.com`;
  }
  
  static getWelcomeSMS(firstName: string): string {
    return `🎉 Bienvenue ${firstName} sur Petites Annonces CI ! Votre compte est activé. Bonne vente !`;
  }
  
  // ==============================================
  // UTILITAIRES CÔTE D'IVOIRE
  // ==============================================
  
  private static normalizeIvoirianPhone(phone: string): string {
    // Nettoyer le numéro
    let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');
    
    // Normaliser au format international +225XXXXXXXX
    if (cleaned.startsWith('+225')) return cleaned;
    if (cleaned.startsWith('00225')) return '+225' + cleaned.slice(5);
    if (cleaned.startsWith('225')) return '+225' + cleaned.slice(3);
    
    // Ajouter +225 si manquant
    return '+225' + cleaned;
  }
  
  private static async getOrangeAccessToken(): Promise<string> {
    // Implémentation authentification Orange CI API
    // À adapter selon la vraie documentation Orange CI
    try {
      const response = await fetch('https://api.orange.com/oauth/v2/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${process.env.ORANGE_CI_CLIENT_ID}:${process.env.ORANGE_CI_CLIENT_SECRET}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
      });
      
      const data = await response.json();
      return data.access_token;
      
    } catch (error) {
      console.error('❌ Erreur authentification Orange:', error);
      throw error;
    }
  }
  
  static validateIvoirianPhone(phone: string): boolean {
    const normalized = this.normalizeIvoirianPhone(phone);
    return /^\+225[0-9]{8,10}$/.test(normalized);
  }
}

// ==============================================
// EXPORTS PRINCIPAUX
// ==============================================

export default {
  UploadService,
  EmailService,
  SMSService
};