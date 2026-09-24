# Writing rules

Write for a tired reader who is not a native English speaker. Make each sentence survive one read.

## Descriptive limits

- Keep each sentence to 25 words or fewer.
- Keep one topic in each paragraph.
- Keep each paragraph to six sentences or fewer.
- Apply the same limits to bullets. Write one complete thought per bullet.

## Vocabulary

- List the concepts before drafting. Pick one name for each concept, then use that name throughout the page.
- Keep domain words such as `webhook`, `sweep`, `triage`, and `quarantine`.
- Do not use technical nouns as verbs. Do not use technical verbs as nouns.
- Use American English spelling.
- Keep multi-word nouns to three words or fewer. Break longer noun chains with a preposition.

## Grammar

- Use active voice. Use passive voice only when the agent is unknown.
- Use simple present, past, or future tenses.
- Do not use an `-ing` clause as a verb.
- Keep articles such as “a” and “the”. Keep “that” where it completes the sentence.
- Put a condition first when a sentence includes one.
- Use a verb for an action, not a noun for the action.

## Anti-slop

- Remove hedges such as “may”, “might”, “could”, and “should”. State the fact or requirement.
- Remove filler, decorative clauses, and rhetorical questions.
- Use one term per concept. Do not rotate synonyms.
- Do not use em-dash asides.
- State the number instead of using an adjective such as “many”, “fast”, or “robust”.
- Replace “e.g.” with “for example”. Replace “i.e.” with “that is”. Name items instead of writing “etc.”.

## Untouchables

Never rewrite code, identifiers, ticket keys, commands, file paths, product names, config keys, or quoted text.

Keep facts unchanged. Do not invent numbers, causes, or exact terms.

## Examples

**Before:** The CI triage process enables teams to quickly identify and resolve flaky test failures.

**After:** CI triage identifies flaky test failures. The team records the cause.

**Before:** When the webhook fails, the system retries the request, making incident response easier.

**After:** If the webhook fails, the system retries the request. The incident report names the cause.

## Self-check before publishing

- [ ] Count words in every sentence. Split any sentence over 25 words.
- [ ] Check that each paragraph has one topic and no more than six sentences.
- [ ] Check that every bullet is complete and follows the same limits.
- [ ] Check that each concept has one term across the page.
- [ ] Check active voice, simple tenses, articles, and no `-ing` verb clauses.
- [ ] Move every condition to the start of its sentence.
- [ ] Remove hedges, filler, decorative clauses, synonym rotation, rhetorical questions, and em-dash asides.
- [ ] Compare untouchable text with the source. Restore any changed code, identifier, ticket key, command, or quote.

Rules paraphrased from ASD-STE100 via the simple-english skill, pragmatic mode.
