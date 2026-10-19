import { ForbiddenError } from "../../shared/errors/index.js";
import type { EventProperties, FeedbackRequestDto } from "./feedback.dto.js";
import type { FeedbackRepository } from "./feedback.repository.js";

export class FeedbackService {
  constructor(private readonly feedback: FeedbackRepository) {}

  async submit(
    ownerId: string,
    body: FeedbackRequestDto,
  ): Promise<{ id: string }> {
    const stored = await this.feedback.feedback(
      ownerId,
      body.rating,
      body.comment,
    );
    if (!stored)
      throw new ForbiddenError(
        "Analytics consent required or feedback quota reached",
      );
    return stored;
  }

  async track(
    ownerId: string,
    name: string,
    properties: EventProperties,
  ): Promise<void> {
    if (!(await this.feedback.productEvent(ownerId, name, properties)))
      throw new ForbiddenError(
        "Analytics consent required or daily event quota reached",
      );
  }
}
