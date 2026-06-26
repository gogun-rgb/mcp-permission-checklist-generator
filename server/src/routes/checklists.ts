import { Router } from "express";
import { generateChecklist } from "../services/checklistService";
import { validateChecklistRequest } from "../services/validation";

export const checklistRouter = Router();

checklistRouter.post("/generate", async (request, response) => {
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
