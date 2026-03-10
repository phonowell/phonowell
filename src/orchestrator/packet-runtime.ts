import type { PacketContext, PacketRecord, PacketStage } from "./types.js";
import { executePacket } from "./packet-executor.js";
import { buildPacketRecord } from "./packet-record-builder.js";

export async function runPacket(stage: PacketStage, context: PacketContext): Promise<PacketRecord> {
  const execution = await executePacket(stage, context);
  return buildPacketRecord({
    stage,
    context,
    execution,
  });
}
