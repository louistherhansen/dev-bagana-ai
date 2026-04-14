import { NextRequest, NextResponse } from "next/server";
import { loadProjectEnv } from "@/lib/load-env";

loadProjectEnv();

// Use Node.js runtime to support nodemailer and other Node.js modules
export const runtime = 'nodejs';

/**
 * Demo request API endpoint (SMTP email)
 * POST body: { nama: string, email: string, perusahaan?: string, timestamp?: string, language?: string }
 * Response: { success: boolean, message?: string, error?: string }
 * 
 * SMTP Configuration:
 * Username: demo@baganatech.com
 * Password: (dari environment variable SMTP_PASSWORD)
 * Outgoing Server: mail.baganatech.com
 * SMTP Port: 465
 */

// Dynamic import untuk nodemailer (ESM compatible)
let nodemailer: any;
try {
  nodemailer = require("nodemailer");
} catch (error) {
  console.error("nodemailer not found. Install with: npm install nodemailer @types/nodemailer");
}

export async function POST(request: NextRequest) {
  try {
    // Validate nodemailer
    if (!nodemailer) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Email service is not available. Please contact the administrator." 
        },
        { 
          status: 503,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          }
        }
      );
    }

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      console.error("Error parsing request body:", parseError);
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid payload format. Please send JSON." 
        },
        { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          }
        }
      );
    }
    
    const { nama, email, perusahaan, timestamp, language } = body;

    // Validate required fields
    if (!nama || !email) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Name and email are required." 
        },
        { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          }
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { 
          success: false, 
          error: "Invalid email format." 
        },
        { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          }
        }
      );
    }

    // SMTP config from environment variables
    const smtpHost = process.env.SMTP_HOST || "mail.baganatech.com";
    const smtpPort = parseInt(process.env.SMTP_PORT || "465", 10);
    const smtpUser = process.env.SMTP_USER || "demo@baganatech.com";
    const smtpPassword = process.env.SMTP_PASSWORD;
    const smtpSecure = process.env.SMTP_SECURE !== "false"; // Default true untuk port 465

    // Validate SMTP password
    if (!smtpPassword) {
      console.error("SMTP_PASSWORD is not configured in environment variables");
      return NextResponse.json(
        { 
          success: false, 
          error: "Email server configuration is incomplete. Please contact the administrator." 
        },
        { 
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          }
        }
      );
    }

    // Recipient email (configurable via env)
    const recipientEmail = process.env.DEMO_REQUEST_RECIPIENT || "sales@bagana.ai";

    // Create SMTP transporter
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure, // true untuk port 465, false untuk port lainnya
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
      // Additional compatibility config
      tls: {
        rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== "false", // Default true for production
      },
    });

    // Verify SMTP connection
    try {
      await transporter.verify();
      console.log("SMTP connection verified successfully");
    } catch (verifyError: any) {
      console.error("SMTP verification failed:", verifyError);
      return NextResponse.json(
        {
          success: false,
          error: verifyError.code === "EAUTH" 
            ? "Failed to authenticate to the email server. Please contact the administrator."
            : "Failed to connect to the email server. Please contact the administrator.",
        },
        { 
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          }
        }
      );
    }

    // Always send English email content (frontend is English-only)
    const isEnglish = true;
    const emailSubject = `New Demo Request from ${nama}`;

    const emailBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #0f766e;">New Demo Request</h2>
          <p>You have received a new demo request from the BAGANA AI landing page.</p>
          
          <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #14b8a6; margin-top: 0;">Request Details:</h3>
            <p><strong>Name:</strong> ${nama}</p>
            <p><strong>Email:</strong> ${email}</p>
            ${perusahaan ? `<p><strong>Company:</strong> ${perusahaan}</p>` : ""}
            ${timestamp ? `<p><strong>Submitted:</strong> ${new Date(timestamp).toLocaleString()}</p>` : ""}
            <p><strong>Language:</strong> ${language === "en" ? "English" : "Indonesian"}</p>
          </div>
          
          <p style="color: #666; font-size: 14px;">
            Please contact this prospect within 1-2 business days to schedule a demo.
          </p>
          
          <hr style="border: none; border-top: 1px solid #ddd; margin: 20px 0;">
          <p style="color: #999; font-size: 12px;">
            This email was sent automatically from the BAGANA AI landing page demo request form.
          </p>
        </div>
      `;

    // Send email
    const mailOptions = {
      from: `"BAGANA AI Landing Page" <${smtpUser}>`,
      to: recipientEmail,
      subject: emailSubject,
      html: emailBody,
      // Add reply-to for convenience
      replyTo: email,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log("Email sent successfully:", info.messageId);

    return NextResponse.json(
      {
        success: true,
        message: "Demo request sent successfully. We will contact you within 1-2 business days.",
        messageId: info.messageId,
      },
      { 
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      }
    );
  } catch (error: any) {
    console.error("Error sending demo request email:", error);
    console.error("Error stack:", error.stack);
    console.error("Error code:", error.code);
    console.error("Error response:", error.response);

    // Handle specific SMTP errors
    if (error.code === "EAUTH" || error.code === "ECONNECTION") {
      return NextResponse.json(
        {
          success: false,
          error: "Failed to authenticate to the email server. Please contact the administrator.",
        },
        { 
          status: 500,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          }
        }
      );
    }

    // Handle JSON parsing errors
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid payload format. Please try again.",
        },
        { 
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
          }
        }
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: error.message || "An error occurred while sending the email. Please try again.",
      },
      { 
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        }
      }
    );
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
