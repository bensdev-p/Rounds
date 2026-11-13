-- Records who graded each attempt, so a disputed grade can be traced to the
-- grader (and, for the LLM, the prompt version and model) that produced it.

create type public.grader as enum ('local', 'llm');

alter table public.attempts
  add column grader public.grader not null default 'local',
  add column grader_version text check (length(grader_version) between 1 and 100),
  add constraint attempts_llm_has_version check (grader = 'local' or grader_version is not null);

comment on column public.attempts.grader_version is
  'e.g. grade-answer/v1@claude-opus-5-5. Null for the local grader.';
