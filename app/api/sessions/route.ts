import { NextResponse } from 'next/server';
import connectDB from '@/lib/mongodb';
import Session from '@/models/Session';
import User from '@/models/User';

export async function POST(req: Request) {
  try {
    // Connect to database
    await connectDB();

    // Get session data from request
    const {
      directionChanges,
      blinkTimestamps,
      stateChanges, // Will be used as lightStateChanges
      distanceChanges,
      startTime,
      userId = null // Optional user ID from the client
    } = await req.json();

    // Calculate end time (now)
    const endTime = new Date();

    // Create the session data object
    const sessionData: {
      startTime: Date;
      endTime: Date;
      directionChanges: any;
      blinkTimestamps: any;
      lightStateChanges: any;
      distanceChanges: any;
      userId?: string;
    } = {
      startTime: new Date(startTime),
      endTime,
      directionChanges,
      blinkTimestamps,
      lightStateChanges: stateChanges,
      distanceChanges
    };

    // If userId is provided and is not null or empty, add it to the session
    if (userId && userId.trim().length > 0) {
      sessionData.userId = userId;
      
      // Verify the user exists
      const user = await User.findById(userId);
      if (!user) {
        return NextResponse.json(
          { message: 'User not found' },
          { status: 404 }
        );
      }
    }

    // Create new session document
    const newSession = await Session.create(sessionData);

    // If we have a user, update their sessions list
    if (userId) {
      await User.findByIdAndUpdate(userId, {
        $push: { sessions: newSession._id }
      });
    }

    // Return success response
    return NextResponse.json(
      { message: 'Session saved successfully', sessionId: newSession._id },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Error saving session:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    // Connect to database
    await connectDB();

    // Get user ID from the URL parameters
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json(
        { message: 'User ID is required' },
        { status: 400 }
      );
    }

    // Find all sessions for the user
    const sessions = await Session.find({ userId })
      .sort({ startTime: -1 }) // Sort by startTime in descending order
      .lean(); // Convert to plain JavaScript objects for better performance

    return NextResponse.json(sessions);
  } catch (error: any) {
    console.error('Error fetching sessions:', error);
    return NextResponse.json(
      { message: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}