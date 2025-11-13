/** @format */

import { z } from 'zod';
import { Agent, AgentInputItem, Runner, withTrace } from '@openai/agents';

const WebResearchAgentSchema = z.object({
  companies: z.array(
    z.object({
      company_name: z.string(),
      industry: z.string(),
      headquarters_location: z.string(),
      company_size: z.string(),
      website: z.string(),
      description: z.string(),
      founded_year: z.number(),
    })
  ),
});
const SummarizeAndDisplaySchema = z.object({
  company_name: z.string(),
  industry: z.string(),
  headquarters_location: z.string(),
  company_size: z.string(),
  website: z.string(),
  description: z.string(),
  founded_year: z.number(),
});
const webResearchAgent = new Agent({
  name: 'Web research agent',
  instructions:
    'You are a helpful assistant. Use web search to find information about the following company I can use in marketing asset based on the underlying topic.',
  model: 'gpt-5-mini',
  outputType: WebResearchAgentSchema,
  modelSettings: {
    reasoning: {
      effort: 'low',
      summary: 'auto',
    },
    store: true,
  },
});

const summarizeAndDisplay = new Agent({
  name: 'Summarize and display',
  instructions: `Put the research together in a nice display using the output format described.
`,
  model: 'gpt-5',
  outputType: SummarizeAndDisplaySchema,
  modelSettings: {
    reasoning: {
      effort: 'minimal',
      summary: 'auto',
    },
    store: true,
  },
});

type WorkflowInput = { input_as_text: string };

// Main code entrypoint
export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace('Web Researcher and Summarizer', async () => {
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
        workflow_id: 'wf_68ed3633bb10819096be009ed7c9cc80069947e501c6f62d',
      },
    });
    const webResearchAgentResultTemp = await runner.run(webResearchAgent, [
      ...conversationHistory,
    ]);
    conversationHistory.push(
      ...webResearchAgentResultTemp.newItems.map((item) => item.rawItem)
    );

    if (!webResearchAgentResultTemp.finalOutput) {
      throw new Error('Agent result is undefined');
    }

    const webResearchAgentResult = {
      output_text: JSON.stringify(webResearchAgentResultTemp.finalOutput),
      output_parsed: webResearchAgentResultTemp.finalOutput,
    };
    const summarizeAndDisplayResultTemp = await runner.run(
      summarizeAndDisplay,
      [...conversationHistory]
    );

    if (!summarizeAndDisplayResultTemp.finalOutput) {
      throw new Error('Agent result is undefined');
    }

    const summarizeAndDisplayResult = {
      output_text: JSON.stringify(summarizeAndDisplayResultTemp.finalOutput),
      output_parsed: summarizeAndDisplayResultTemp.finalOutput,
    };
  });
};
