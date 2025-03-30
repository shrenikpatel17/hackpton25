import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { metrics } = await request.json();
    console.log(metrics);
    
    // Round the metrics values to integers, with safe handling for missing values
    const roundedMetrics = {
      B: metrics.B ? Math.round(metrics.B) : null,
      D: metrics.D ? Math.round(metrics.D) : null,
      C: metrics.C ? Math.round(metrics.C) : null,
      T: metrics.T ? Math.round(metrics.T) : null
    };

    // Build metrics strings based on available values
    const metricStrings = [];
    if (roundedMetrics.B !== null) {
      metricStrings.push(`- Average blink rate (${roundedMetrics.B} blinks/min, if more than 15 blinks, then is good)`);
    }
    if (roundedMetrics.D !== null) {
      metricStrings.push(`- Percentage of time in bright environment versus a dark one (${roundedMetrics.D}%, if more than 80%, then is good)`);
    }
    if (roundedMetrics.C !== null) {
      metricStrings.push(`- Percentage of time looking away from screen center (${roundedMetrics.C}%, if more than 30%, then is good)`);
    }
    if (roundedMetrics.T !== null) {
      metricStrings.push(`- Percentage of time at safe distance 50cm from screen (${roundedMetrics.T}%, if more than 98%, then is good)`);
    }

    // const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro-001" });
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-001" });

    const prompt = `
    Analyze the following metrics that represent screen usage patterns:
    ${metricStrings.join('\n')}

    Please provide your response in two clear sections:

    ANALYSIS:
    Analyze each metric. Use "you" instead of "the user" when referring to the person.

    SUGGESTIONS:
    Based on the analysis, provide three targeted suggestions.
    Keep suggestions clear and actionable, avoid using any markdown formatting.
    Use "you" instead of "the user" when giving suggestions.`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    // Split text into analysis and suggestions sections
    const sections = text.split(/ANALYSIS:|SUGGESTIONS:/);
    
    // Process the analysis section
    const analysis = sections[1]?.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/[#*`_]/g, ''))
      .map(line => line.replace(/^[•·-]\s*/g, ''))
      .filter(line => line.length > 0)
      .map((line, index) => `${line.charAt(0).toUpperCase() + line.slice(1)}`) || [];

    // Process the suggestions section
    const suggestions = sections[2]?.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(line => line.replace(/[#*`_]/g, ''))
      .map(line => line.replace(/^[•·-]\s*/g, ''))
      .map((line, index) => `${line.charAt(0).toUpperCase() + line.slice(1)}`) || [];

    return NextResponse.json({ 
      analysis,
      suggestions
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return NextResponse.json(
      { error: "Failed to generate recommendations" },
      { status: 500 }
    );
  }
} 