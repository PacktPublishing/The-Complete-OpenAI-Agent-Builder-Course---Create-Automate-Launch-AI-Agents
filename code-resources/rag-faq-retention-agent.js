/** @format */

import {
  tool,
  fileSearchTool,
  Agent,
  AgentInputItem,
  Runner,
  withTrace,
} from '@openai/agents';
import { z } from 'zod';
import { OpenAI } from 'openai';
import { runGuardrails } from '@openai/guardrails';

// Tool definitions
const proposeRetentionOption = tool({
  name: 'proposeRetentionOption',
  description:
    'Select an option to propose to a customer considering canceling their membership.',
  parameters: z.object({
    customer_status: z.string(),
    reason_for_cancellation: z.string(),
    options: z.array(),
  }),
  execute: async (input: {
    customer_status: string,
    reason_for_cancellation: string,
    options: array,
  }) => {
    // TODO: Unimplemented
  },
});
const fileSearch = fileSearchTool(['vs_68ed3d655bb88191b1d4e993e001f455']);

// Shared client for guardrails and file search
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Guardrails definitions
const jailbreakGuardrailsConfig = {
  guardrails: [
    {
      name: 'Jailbreak',
      config: {
        model: 'gpt-4.1-mini',
        confidence_threshold: 0.7,
      },
    },
  ],
};
const context = { guardrailLlm: client };

// Guardrails utils
function guardrailsHasTripwire(results) {
  return (results ?? []).some((r) => r?.tripwireTriggered === true);
}

function getGuardrailSafeText(results, fallbackText) {
  // Prefer checked_text as the generic safe/processed text
  for (const r of results ?? []) {
    if (r?.info && 'checked_text' in r.info) {
      return r.info.checked_text ?? fallbackText;
    }
  }
  // Fall back to PII-specific anonymized_text if present
  const pii = (results ?? []).find(
    (r) => r?.info && 'anonymized_text' in r.info
  );
  return pii?.info?.anonymized_text ?? fallbackText;
}

function buildGuardrailFailOutput(results) {
  const get = (name) =>
      (results ?? []).find((r) => {
        const info = r?.info ?? {};
        const n = info?.guardrail_name ?? info?.guardrailName;
        return n === name;
      }),
    pii = get('Contains PII'),
    mod = get('Moderation'),
    jb = get('Jailbreak'),
    hal = get('Hallucination Detection'),
    piiCounts = Object.entries(pii?.info?.detected_entities ?? {})
      .filter(([, v]) => Array.isArray(v))
      .map(([k, v]) => k + ':' + v.length),
    thr = jb?.info?.threshold,
    conf = jb?.info?.confidence;

  return {
    pii: {
      failed: piiCounts.length > 0 || pii?.tripwireTriggered === true,
      ...(piiCounts.length ? { detected_counts: piiCounts } : {}),
      ...(pii?.executionFailed && pii?.info?.error
        ? { error: pii.info.error }
        : {}),
    },
    moderation: {
      failed:
        mod?.tripwireTriggered === true ||
        (mod?.info?.flagged_categories ?? []).length > 0,
      ...(mod?.info?.flagged_categories
        ? { flagged_categories: mod.info.flagged_categories }
        : {}),
      ...(mod?.executionFailed && mod?.info?.error
        ? { error: mod.info.error }
        : {}),
    },
    jailbreak: {
      // Rely on runtime-provided tripwire; don't recompute thresholds
      failed: jb?.tripwireTriggered === true,
      ...(jb?.executionFailed && jb?.info?.error
        ? { error: jb.info.error }
        : {}),
    },
    hallucination: {
      // Rely on runtime-provided tripwire; don't recompute
      failed: hal?.tripwireTriggered === true,
      ...(hal?.info?.reasoning ? { reasoning: hal.info.reasoning } : {}),
      ...(hal?.info?.hallucination_type
        ? { hallucination_type: hal.info.hallucination_type }
        : {}),
      ...(hal?.info?.hallucinated_statements
        ? { hallucinated_statements: hal.info.hallucinated_statements }
        : {}),
      ...(hal?.info?.verified_statements
        ? { verified_statements: hal.info.verified_statements }
        : {}),
      ...(hal?.executionFailed && hal?.info?.error
        ? { error: hal.info.error }
        : {}),
    },
  };
}
const QueryClassifierSchema = z.object({
  classification: z.enum([
    'return_item',
    'cancel_subscription',
    'get_information',
  ]),
});
const faqAgent = new Agent({
  name: 'FAQ Agent',
  instructions:
    'You are a helpful assistant that answers user questions about a specific topic. Only provide answers based strictly on the information available in the provided documents within the database you have access to. Do not answer questions using outside knowledge or speculation. If the answer cannot be found in the documents, politely inform the user that the information is not available.',
  model: 'gpt-5-mini',
  tools: [fileSearch],
  modelSettings: {
    reasoning: {
      effort: 'low',
      summary: 'auto',
    },
    store: true,
  },
});

const queryClassifier = new Agent({
  name: 'Query Classifier',
  instructions: ` Classify each incoming user query according to its intent, selecting one of the following categories:
1. return_item – if the query is primarily about requesting a return or exchanging a purchased item.
2. get_information – if the user is asking for details, information, or clarification about a product, order, or service.
3. cancel_subscription – if the user wants to cancel, end, or stop an ongoing subscription or recurring service.


Make sure that JSON returns either \"return_item\", or \"cancel_subscription\" or \"get_information\". That's all.
---
**IMPORTANT:**
- Always classify queries using the categories above.`,
  model: 'gpt-5',
  outputType: QueryClassifierSchema,
  modelSettings: {
    reasoning: {
      effort: 'low',
      summary: 'auto',
    },
    store: true,
  },
});

const retentionAgent = new Agent({
  name: 'Retention Agent',
  instructions: `You are a customer retention conversational agent whose goal is to prevent subscription cancellations. Ask for their current plan and reason for dissatisfaction. 
Use the propose_retention_option to identify options to show to the customer.

Once you've received the options, pick the one that makes the most sense and present to the customer.

DO NOT ask to generate the response nor to submit the response; you do it all yourself.


`,
  model: 'gpt-5',
  tools: [proposeRetentionOption],
  modelSettings: {
    parallelToolCalls: true,
    reasoning: {
      effort: 'low',
      summary: 'auto',
    },
    store: true,
  },
});

const returnAgent = new Agent({
  name: 'Return Agent',
  instructions: 'Offer a replacement device with free shipping.',
  model: 'gpt-4.1-mini',
  modelSettings: {
    temperature: 1,
    topP: 1,
    maxTokens: 2048,
    store: true,
  },
});

const approvalRequest = (message: string) => {
  // TODO: Implement
  return true;
};

type WorkflowInput = { input_as_text: string };

// Main code entrypoint
export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace('RAG - FAQ and Retention Agents', async () => {
    const state = {};
    const conversationHistory: AgentInputItem[] = [
      {
        role: 'user',
        content: [
          {
            type: 'input_text',
            text: workflow.input_as_text,
          },
        ],
      },
    ];
    const runner = new Runner({
      traceMetadata: {
        __trace_source__: 'agent-builder',
        workflow_id: 'wf_68eds24964819092be4005e54b917c0e0a8e21244f1e26',
      },
    });
    const guardrailsInputtext = workflow.input_as_text;
    const guardrailsResult = await runGuardrails(
      guardrailsInputtext,
      jailbreakGuardrailsConfig,
      context
    );
    const guardrailsHastripwire = guardrailsHasTripwire(guardrailsResult);
    const guardrailsAnonymizedtext = getGuardrailSafeText(
      guardrailsResult,
      guardrailsInputtext
    );
    const guardrailsOutput = guardrailsHastripwire
      ? buildGuardrailFailOutput(guardrailsResult ?? [])
      : { safe_text: guardrailsAnonymizedtext ?? guardrailsInputtext };
    if (guardrailsHastripwire) {
      const endResult = {
        explain: 'Something went wrong.  Try again later.',
      };
      return endResult;
    } else {
      const queryClassifierResultTemp = await runner.run(queryClassifier, [
        ...conversationHistory,
      ]);
      conversationHistory.push(
        ...queryClassifierResultTemp.newItems.map((item) => item.rawItem)
      );

      if (!queryClassifierResultTemp.finalOutput) {
        throw new Error('Agent result is undefined');
      }

      const queryClassifierResult = {
        output_text: JSON.stringify(queryClassifierResultTemp.finalOutput),
        output_parsed: queryClassifierResultTemp.finalOutput,
      };
      if (
        queryClassifierResult.output_parsed.classification ==
        'cancel_subscription'
      ) {
        const retentionAgentResultTemp = await runner.run(retentionAgent, [
          ...conversationHistory,
        ]);
        conversationHistory.push(
          ...retentionAgentResultTemp.newItems.map((item) => item.rawItem)
        );

        if (!retentionAgentResultTemp.finalOutput) {
          throw new Error('Agent result is undefined');
        }

        const retentionAgentResult = {
          output_text: retentionAgentResultTemp.finalOutput ?? '',
        };
      } else if (
        queryClassifierResult.output_parsed.classification == 'return_item'
      ) {
        const returnAgentResultTemp = await runner.run(returnAgent, [
          ...conversationHistory,
        ]);
        conversationHistory.push(
          ...returnAgentResultTemp.newItems.map((item) => item.rawItem)
        );

        if (!returnAgentResultTemp.finalOutput) {
          throw new Error('Agent result is undefined');
        }

        const returnAgentResult = {
          output_text: returnAgentResultTemp.finalOutput ?? '',
        };
        const approvalMessage = 'Does this work for you?';

        if (approvalRequest(approvalMessage)) {
          const endResult = {
            final_result: "Great! We'll ship it to you!",
          };
          return endResult;
        } else {
          const endResult = {
            final_result: "Okay, you've chose to return the product.",
          };
          return endResult;
        }
      } else if (
        queryClassifierResult.output_parsed.classification == 'get_information'
      ) {
        const faqAgentResultTemp = await runner.run(faqAgent, [
          ...conversationHistory,
        ]);
        conversationHistory.push(
          ...faqAgentResultTemp.newItems.map((item) => item.rawItem)
        );

        if (!faqAgentResultTemp.finalOutput) {
          throw new Error('Agent result is undefined');
        }

        const faqAgentResult = {
          output_text: faqAgentResultTemp.finalOutput ?? '',
        };
      } else {
        const faqAgentResultTemp = await runner.run(faqAgent, [
          ...conversationHistory,
        ]);
        conversationHistory.push(
          ...faqAgentResultTemp.newItems.map((item) => item.rawItem)
        );

        if (!faqAgentResultTemp.finalOutput) {
          throw new Error('Agent result is undefined');
        }

        const faqAgentResult = {
          output_text: faqAgentResultTemp.finalOutput ?? '',
        };
      }
    }
  });
};
