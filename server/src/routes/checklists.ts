import { Router } from "express";
import { generateChecklist } from "../services/checklistService";
import {
  createInMemoryRateLimiter,
  readPositiveInteger
} from "../services/rateLimit";
import { validateChecklistRequest } from "../services/validation";

export const checklistRouter = Router();
const generateRateLimiter = createInMemoryRateLimiter({
  windowMs: 60_000,
  maxRequests: () => readPositiveInteger(process.env.CHECKLIST_RATE_LIMIT_PER_MINUTE, 10),
  keyPrefix: "checklists.generate"
});

checklistRouter.post("/generate", generateRateLimiter, async (request, response) => {
  const validation = validateChecklistRequest(request.body);

  if (!validation.ok || !validation.value) {
    response.status(400).json({
      error: validation.error ?? "요청을 처리할 수 없습니다."
    });
    return;
  }

  const result = await generateChecklist(validation.value);
  response.json(result);
});
