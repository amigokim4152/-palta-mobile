import type { DatabasePort } from '../ports/databasePort.js';
import type { ActorRef } from '../messaging/contracts.js';
import type {
  MessageAudienceContext,
  MessageAudienceContextPort,
} from './messageNotificationAudience.js';

export class PostgresMessageAudienceContext
  implements MessageAudienceContextPort {
  constructor(private readonly db: DatabasePort) {}

  async load(input: {
    conversationId: string;
    messageId: string;
  }): Promise<MessageAudienceContext | null> {
    const messageResult = await this.db.query(
      `select sender_actor_type, sender_actor_id, sender_principal_user_id
         from msg_message
        where conversation_id = $1
          and id = $2
        limit 1`,
      [input.conversationId, input.messageId],
    );
    const message = messageResult.rows[0];
    if (!message) return null;

    const participantResult = await this.db.query(
      `select actor_type, actor_id, principal_user_id, muted
         from msg_participant
        where conversation_id = $1
          and left_at is null`,
      [input.conversationId],
    );

    const senderPrincipal = message.sender_principal_user_id;
    const sender: ActorRef = {
      actorType: String(message.sender_actor_type) as ActorRef['actorType'],
      actorId: String(message.sender_actor_id),
      ...(senderPrincipal !== null && senderPrincipal !== undefined
        ? { principalUserId: String(senderPrincipal) }
        : {}),
    };

    return {
      sender,
      participants: participantResult.rows.map((row) => {
        const participantPrincipal = row.principal_user_id;
        return {
          actor: {
            actorType: String(row.actor_type) as ActorRef['actorType'],
            actorId: String(row.actor_id),
            ...(participantPrincipal !== null && participantPrincipal !== undefined
              ? { principalUserId: String(participantPrincipal) }
              : {}),
          },
          muted: Boolean(row.muted),
        };
      }),
    };
  }
}
