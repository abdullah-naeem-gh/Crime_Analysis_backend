import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;
if (!API_KEY) {
  console.error("ERROR: Gemini API key not found in environment variables");
}

const genAI = new GoogleGenerativeAI(API_KEY);

export async function generateContent(prompt) {
  try {
    // For text-only input, use the gemini-pro model
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    
    // Generate content based on prompt type
    let result;
    
    if (Array.isArray(prompt)) {
      // Handle structured prompts with system instructions
      const generationConfig = {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 8192,
      };
      
      // Correct format for Gemini API
      // Convert 'system' roles to 'user' roles as Gemini doesn't support system roles
      const formattedPrompts = prompt.map(p => {
        if (p.role === 'system') {
          console.warn("Warning: Converting 'system' role to 'user' role for Gemini compatibility");
          return {
            role: 'user',
            parts: [{ text: "System instruction: " + p.content }]
          };
        }
        return {
          role: p.role,
          parts: [{ text: p.content }]
        };
      });
      
      result = await model.generateContent({
        contents: formattedPrompts,
        generationConfig,
      });
    } else {
      // Handle simple string prompts
      result = await model.generateContent(prompt);
    }
    
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating content with Gemini:", error);
    if (error.message && error.message.includes("insufficient authentication scopes")) {
      throw new Error("API key permissions issue: The Gemini API key doesn't have sufficient permissions");
    }
    throw error;
  }
}

export async function generateContentFromImage(prompt, imageData, options = {}) {
  try {
    // For multimodal input (text + images), use the gemini-pro-vision model
    const model = genAI.getGenerativeModel({ model: "gemini-pro-vision" });

    const imagePart = {
      inlineData: {
        data: imageData,
        mimeType: "image/jpeg", // Adjust mime type as needed
      },
    };

    // Generate content from text and image
    const result = await model.generateContent([prompt, imagePart]);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error("Error generating content from image with Gemini:", error);
    throw error;
  }
}
