import { omit } from "lodash";
import mongoose from "mongoose";
import { AITokenUsageInterface } from "../../types/ai";
import { OrganizationInterface } from "../../types/organization";

type AITokenUsageDocument = mongoose.Document & AITokenUsageInterface;

const RESET_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

const aiTokenUsageSchema = new mongoose.Schema({
  id: String,
  organization: String,
  numTokensUsed: Number,
  lastResetAt: Number,
});

const AITokenUsageModel = mongoose.model<AITokenUsageDocument>(
  "AITokenUsage",
  aiTokenUsageSchema
);

const toInterface = (doc: AITokenUsageDocument): AITokenUsageInterface =>
  omit(doc.toJSON(), ["__v", "_id"]);

export const updateTokenUsage = async ({
  organization,
  numTokensUsed,
}: {
  organization: OrganizationInterface;
  numTokensUsed: number;
}) => {
  let tokenUsage = await AITokenUsageModel.findOne({
    organization: organization.id,
  });

  if (!tokenUsage) {
    tokenUsage = await AITokenUsageModel.create({
      organization: organization.id,
      numTokensUsed: 0,
      lastResetAt: new Date().getTime(),
    });
  }

  let lastResetAt = tokenUsage.lastResetAt;
  const now = new Date().getTime();
  if (now - lastResetAt > RESET_INTERVAL) {
    lastResetAt = now;
    tokenUsage.numTokensUsed = 0;
  }

  tokenUsage.numTokensUsed += numTokensUsed;

  await tokenUsage.save();

  return toInterface(tokenUsage);
};

export const getTokenUsedByOrganization = async (
  organization: OrganizationInterface
): Promise<AITokenUsageInterface["numTokensUsed"]> => {
  const tokenUsage = await updateTokenUsage({
    organization,
    numTokensUsed: 0,
  });
  return tokenUsage.numTokensUsed;
};
