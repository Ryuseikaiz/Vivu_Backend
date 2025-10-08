const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.log('SMTP credentials not configured. Email will be simulated.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      },
      tls: {
        rejectUnauthorized: false // For development only
      }
    });

    // Verify connection
    this.transporter.verify((error, success) => {
      if (error) {
        console.error('SMTP connection error:', error);
        this.transporter = null;
      } else {
        console.log('SMTP server is ready to send emails');
      }
    });
  }

  async sendTravelEmail({ from, to, subject, travelInfo }) {
    if (!this.transporter) {
      console.log('SMTP not configured. Email would be sent to:', to);
      console.log('Subject:', subject);
      console.log('Content:', travelInfo);
      return { message: 'Email simulated (no SMTP configuration)' };
    }

    try {
      const htmlContent = this.formatEmailContent(travelInfo);
      
      const mailOptions = {
        from: `"AI Travel Agent" <${process.env.SMTP_USER}>`,
        to: to,
        subject: subject,
        html: htmlContent,
        replyTo: from
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email sent successfully:', info.messageId);
      return { messageId: info.messageId, message: 'Email sent successfully' };
    } catch (error) {
      console.error('Error sending email:', error);
      throw new Error('Failed to send email');
    }
  }

  formatEmailContent(travelInfo) {
    // If travelInfo is already HTML, use it directly
    if (travelInfo.includes('<html>') || travelInfo.includes('<!DOCTYPE')) {
      return travelInfo;
    }

    // Otherwise, wrap in basic HTML structure with better styling
    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Thông tin du lịch - AI Travel Agent</title>
        <meta charset="UTF-8">
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 0;
                background-color: #f5f5f5;
            }
            .container { 
                max-width: 800px; 
                margin: 0 auto; 
                padding: 20px; 
                background-color: white;
                box-shadow: 0 0 10px rgba(0,0,0,0.1);
            }
            .header {
                background: linear-gradient(135deg, #3498db, #2980b9);
                color: white;
                padding: 20px;
                text-align: center;
                margin: -20px -20px 20px -20px;
            }
            h1, h2 { color: #2c3e50; margin-top: 30px; }
            .flight, .hotel { 
                margin: 20px 0; 
                padding: 20px; 
                border-left: 4px solid #3498db; 
                background-color: #f8f9fa;
                border-radius: 5px;
            }
            img { 
                max-width: 100px; 
                height: auto; 
                margin: 10px 0;
                border-radius: 5px;
            }
            a { 
                color: #3498db; 
                text-decoration: none;
                font-weight: 500;
            }
            a:hover { text-decoration: underline; }
            .footer {
                margin-top: 40px;
                padding-top: 20px;
                border-top: 1px solid #eee;
                text-align: center;
                color: #666;
                font-size: 14px;
            }
            .price {
                background-color: #e8f5e8;
                color: #27ae60;
                padding: 5px 10px;
                border-radius: 3px;
                font-weight: bold;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>✈️🌍 AI Travel Agent 🏨🗺️</h1>
                <p>Thông tin du lịch được tạo bởi AI</p>
            </div>
            ${travelInfo}
            <div class="footer">
                <p>Email này được gửi từ AI Travel Agent</p>
                <p>Cảm ơn bạn đã sử dụng dịch vụ của chúng tôi!</p>
            </div>
        </div>
    </body>
    </html>`;
  }
}

module.exports = EmailService;