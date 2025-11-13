/** @format */

import {
  RunContext,
  Agent,
  AgentInputItem,
  Runner,
  withTrace,
} from '@openai/agents';

interface StoryTellerContext {
  stateTopic: string;
  stateNumTweets: string;
}
const storyTellerInstructions = (
  runContext: RunContext<StoryTellerContext>,
  _agent: Agent<StoryTellerContext>
) => {
  const { stateTopic, stateNumTweets } = runContext.context;
  return `Your job is to take the input topic ${stateTopic}  from the previous node and create ${stateNumTweets}  150-character-long tweets.  

Make sure it's funny and include appropriate emojis. `;
};
const storyTeller = new Agent({
  name: 'Story Teller',
  instructions: storyTellerInstructions,
  model: 'gpt-5',
  modelSettings: {
    reasoning: {
      effort: 'low',
      summary: 'auto',
    },
    store: true,
  },
});

type WorkflowInput = { input_as_text: string };

// Main code entrypoint
export const runWorkflow = async (workflow: WorkflowInput) => {
  return await withTrace('New workflow', async () => {
    const state = {
      topic: null,
      num_tweets: 2,
    };
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
        workflow_id: 'wf_68dqllz9ff8664788190a04336fe890177c802a189b3e3ac70c6',
      },
    });
    state.topic = workflow.input_as_text;
    const storyTellerResultTemp = await runner.run(
      storyTeller,
      [...conversationHistory],
      {
        context: {
          stateTopic: state.topic,
          stateNumTweets: state.num_tweets,
        },
      }
    );
    conversationHistory.push(
      ...storyTellerResultTemp.newItems.map((item) => item.rawItem)
    );

    if (!storyTellerResultTemp.finalOutput) {
      throw new Error('Agent result is undefined');
    }

    const storyTellerResult = {
      output_text: storyTellerResultTemp.finalOutput ?? '',
    };
    return storyTellerResult;
  });
};
