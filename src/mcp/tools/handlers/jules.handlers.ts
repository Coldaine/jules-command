/**
 * Jules tool handlers - wrappers around JulesService methods
 */

import { JulesService } from '../../../services/jules.service.js';
import type { ToolContext } from '../index.js';
import { toolSchemas } from '../schemas.js';

export async function handleCreateSession(
  args: unknown,
  context: ToolContext
) {
  const parsed = toolSchemas.jules_create_session.parse(args);
  const service = new JulesService(context.config, context.db);
  const result = await service.createSession(parsed);
  return {
    sessionId: result.sessionId,
    url: result.url,
  };
}

export async function handleGetSession(
  args: unknown,
  context: ToolContext
) {
  const parsed = toolSchemas.jules_get_session.parse(args);
  const service = new JulesService(context.config, context.db);
  return service.getSession(parsed.sessionId);
}

export async function handleApprovePlan(
  args: unknown,
  context: ToolContext
) {
  const parsed = toolSchemas.jules_approve_plan.parse(args);
  const service = new JulesService(context.config, context.db);
  await service.approvePlan(parsed.sessionId);
  return { success: true };
}

export async function handleSendMessage(
  args: unknown,
  context: ToolContext
) {
  const parsed = toolSchemas.jules_send_message.parse(args);
  const service = new JulesService(context.config, context.db);
  await service.sendMessage(parsed.sessionId, parsed.message);
  return { success: true };
}

export async function handleGetDiff(
  args: unknown,
  context: ToolContext
) {
  const parsed = toolSchemas.jules_get_diff.parse(args);
  const service = new JulesService(context.config, context.db);
  return service.getDiff(parsed.sessionId, parsed.file);
}

export async function handleGetBashOutputs(
  args: unknown,
  context: ToolContext
) {
  const parsed = toolSchemas.jules_get_bash_outputs.parse(args);
  const service = new JulesService(context.config, context.db);
  return service.getBashOutputs(parsed.sessionId);
}
