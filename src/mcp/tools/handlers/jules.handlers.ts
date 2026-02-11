/**
 * Jules tool handlers - wrappers around JulesService methods
 */

import { JulesService } from '../../../services/jules.service.js';
import type { ToolContext } from '../index.js';
import { toolSchemas } from '../schemas.js';
import type { z } from 'zod';

export async function handleCreateSession(
  args: z.infer<typeof toolSchemas.jules_create_session>,
  context: ToolContext
) {
  const service = new JulesService(context.config, context.db);
  const result = await service.createSession(args);
  return {
    sessionId: result.sessionId,
    url: result.url,
  };
}

export async function handleGetSession(
  args: z.infer<typeof toolSchemas.jules_get_session>,
  context: ToolContext
) {
  const service = new JulesService(context.config, context.db);
  return service.getSession(args.sessionId);
}

export async function handleApprovePlan(
  args: z.infer<typeof toolSchemas.jules_approve_plan>,
  context: ToolContext
) {
  const service = new JulesService(context.config, context.db);
  await service.approvePlan(args.sessionId);
  return { success: true };
}

export async function handleSendMessage(
  args: z.infer<typeof toolSchemas.jules_send_message>,
  context: ToolContext
) {
  const service = new JulesService(context.config, context.db);
  await service.sendMessage(args.sessionId, args.message);
  return { success: true };
}

export async function handleGetDiff(
  args: z.infer<typeof toolSchemas.jules_get_diff>,
  context: ToolContext
) {
  const service = new JulesService(context.config, context.db);
  return service.getDiff(args.sessionId, args.file);
}

export async function handleGetBashOutputs(
  args: z.infer<typeof toolSchemas.jules_get_bash_outputs>,
  context: ToolContext
) {
  const service = new JulesService(context.config, context.db);
  return service.getBashOutputs(args.sessionId);
}
