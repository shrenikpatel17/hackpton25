import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { metrics } = await request.json();
    console.log(metrics);
    
    // const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-001" });
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

    const prompt = `
    The health score is calculated based on the following formula:
    \[
      \text{score} = 0.4 \times \min\left(\frac{\text{Average blink rate (blinks/min)}}{14}, 1\right) 
      + 0.3 \times \min\left(\frac{\text{Percentage of time in bright environment}}{0.80}, 1\right) 
      + 0.1 \times \min\left(\frac{\text{Percentage of time looking away from screen center}}{0.35}, 1\right) 
      + 0.2 \times \min\left(\frac{\text{Percentage of time at safe distance (50cm) from screen}}{0.98}, 1\right)
    \]

    This is the score value of me: ${metrics.score}

    Please provide your response in one clear sections:

    SUGGESTIONS:
    give me three short phrases as suggestions, no complete sentences, just three shorst phrases in three lines, no asterisks, no serial numbers.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    console.log("AI Response:", text);
    
    // Parse the response to extract prediction and suggestions
    const sections = text.split('SUGGESTIONS:');
    const suggestions = sections[0];

    console.log("Suggestions:", suggestions);
    return NextResponse.json({ 
      "prediction": "43",
      "suggestions": suggestions
    });
  } catch (error) {
    console.error("Error generating myopia prediction and suggestions:", error);
    return NextResponse.json(
      { error: "Failed to generate myopia prediction and suggestions" },
      { status: 500 }
    );
  }
} 