import type { ConversationAnalysis, PacketContext } from "./types.js";
import { runPacket } from "./packet-runtime.js";

export async function analyzeConversation(
  context: PacketContext,
): Promise<ConversationAnalysis> {
  const packet = await runPacket("analyze", context);
  return {
    summary: packet.response.structured?.summary ?? packet.response.summary,
    outputSource: packet.response.outputSource,
    provenanceNotes: packet.response.structured?.provenanceNotes ?? [],
  };
}
