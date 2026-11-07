import mongoose from 'mongoose';
import { Activity, Team, User, Workout } from '../models/index.js';

function isValidId(value: unknown): value is string {
  return typeof value === 'string' && mongoose.isValidObjectId(value);
}

function badRequest(message: string) {
  return Object.assign(new Error(message), { status: 400 });
}

function notFound(message: string) {
  return Object.assign(new Error(message), { status: 404 });
}

export async function listActivities() {
  return Activity.find().sort({ occurredAt: -1 }).lean();
}

export async function createActivity(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Activity payload is required');
  }

  const payload = input as Record<string, unknown>;
  const { userId, teamId, type, minutes } = payload;

  if (!userId || !teamId || !type || minutes === undefined) {
    throw badRequest('userId, teamId, type, and minutes are required');
  }

  if (!isValidId(userId) || !isValidId(teamId)) {
    throw badRequest('userId and teamId must be valid ObjectIds');
  }

  if (typeof type !== 'string' || !type.trim()) {
    throw badRequest('type is required');
  }

  const numericMinutes = Number(minutes);
  if (!Number.isFinite(numericMinutes) || numericMinutes <= 0) {
    throw badRequest('minutes must be a positive number');
  }

  const [userExists, teamExists] = await Promise.all([
    User.exists({ _id: userId }),
    Team.exists({ _id: teamId }),
  ]);

  if (!userExists || !teamExists) {
    throw notFound('Referenced user or team was not found');
  }

  const created = await Activity.create({
    user: userId,
    team: teamId,
    type: type.trim(),
    minutes: numericMinutes,
    points: numericMinutes,
    occurredAt: new Date(),
  });

  return created.toObject();
}

export async function listTeams() {
  return Team.find().sort({ name: 1 }).lean();
}

export async function createTeam(input: unknown) {
  if (!input || typeof input !== 'object') {
    throw badRequest('Team payload is required');
  }

  const payload = input as Record<string, unknown>;
  const { name, mascot, members } = payload;

  if (typeof name !== 'string' || !name.trim()) {
    throw badRequest('Team name is required');
  }

  if (typeof mascot !== 'string' || !mascot.trim()) {
    throw badRequest('Team mascot is required');
  }

  const normalizedMembers = Array.isArray(members) ? members : [];
  for (const member of normalizedMembers) {
    if (typeof member !== 'string' || !mongoose.isValidObjectId(member)) {
      throw badRequest('Each team member must be a valid ObjectId');
    }
  }

  const created = await Team.create({
    name: name.trim(),
    mascot: mascot.trim(),
    members: normalizedMembers,
  });

  return created.toObject();
}

export async function getLeaderboard() {
  const rows = await Activity.aggregate([
    { $group: { _id: '$team', totalPoints: { $sum: '$points' } } },
    { $lookup: { from: 'teams', localField: '_id', foreignField: '_id', as: 'team' } },
    { $unwind: '$team' },
    { $project: { _id: 0, teamId: '$_id', teamName: '$team.name', totalPoints: 1 } },
    { $sort: { totalPoints: -1, teamName: 1 } },
  ]);

  return rows.map((row, index) => ({
    teamName: row.teamName,
    totalPoints: row.totalPoints,
    rank: index + 1,
  }));
}

export async function suggestWorkouts(userEmail: string) {
  if (!userEmail || typeof userEmail !== 'string') {
    throw badRequest('A user email is required');
  }

  const user = await User.findOne({ email: userEmail.trim() }).lean();
  if (!user) {
    throw notFound('User not found');
  }

  const recentActivities = await Activity.find({ user: user._id }).sort({ occurredAt: -1 }).limit(5).lean();
  const preferredFocus =
    (user.fitnessGoal as string | undefined)?.trim() ||
    recentActivities[0]?.type ||
    'endurance';

  const matches = await Workout.find({ focus: preferredFocus }).sort({ minutes: 1 }).lean();
  const fallback = await Workout.find().sort({ minutes: 1 }).lean();
  const suggestions = matches.length > 0 ? matches : fallback;

  return suggestions.map((workout) => ({
    ...workout,
    reason: `Matches your ${recentActivities[0]?.type ?? user.fitnessGoal ?? 'activity'} pattern and ${preferredFocus} focus.`,
  }));
}

export { User };
