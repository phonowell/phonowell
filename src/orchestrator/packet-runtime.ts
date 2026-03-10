import type { PacketContext, PacketRecord, PacketRunOptions, PacketStage } from "./types.js";
import { executePacket } from "./packet-executor.js";
import { buildPacketRecord } from "./packet-record-builder.js";

export async function runPacket(
  stage: PacketStage,
  context: PacketContext,
  options: PacketRunOptions = {},
): Promise<PacketRecord> {
  const execution = await executePacket(stage, context, options);
  return buildPacketRecord({
    stage,
    context,
    execution,
  });
}
