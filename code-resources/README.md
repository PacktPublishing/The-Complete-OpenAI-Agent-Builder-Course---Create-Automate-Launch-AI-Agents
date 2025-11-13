# AgentBuilder Course - Code Resources

Welcome to the code resources for the **AgentBuilder** course! This folder contains all the complete implementation files for the various agents and workflows we build throughout the course.

## 📁 What's in This Folder?

This folder contains the following complete agent implementations:

- **`article-writer-summarizer.js`** - Article generation and summarization workflow
- **`rag-faq-retention-agent-final.js`** - Final version of the customer retention agent with RAG and FAQ capabilities
- **`rag-faq-retention-agent.js`** - Initial version of the retention agent
- **`set-state-story-teller.js`** - Story-telling agent with state management
- **`state-while-loop.js`** - Complex workflow with state and loop handling
- **`web-researcher-summarizer.js`** - Web research and summarization agent

## 🎯 Purpose of These Files

These files serve as a **reference and convenience resource** for course participants. They contain the complete, working code for each agent we build during the course, including all the final prompts and instructions.

## 🔍 What to Focus On (If Code Isn't Your Thing)

**If you're not a developer or prefer not to dive deep into the code**, the most valuable parts for you are the **agent instruction prompts**. These are the natural language instructions that define how each agent behaves.

### Where to Find Agent Instructions

In each file, look for sections that contain `instructions:` followed by text in quotes. These are the prompts that tell the AI agent what to do. For example:

```javascript
instructions: `Generate an article on the given topic, then summarize the generated article in an easy-to-understand manner, using simple language that is accessible to a general audience.

- Begin by analyzing the topic and identifying its key points or core ideas...`
```

## 💡 How to Use These Resources

### Option 1: Follow Along in the Course ✅ **Recommended**
- Watch the course videos where I demonstrate building these agents step by step
- See how the AI and I craft these instruction prompts together
- Learn the thinking process behind effective prompt engineering
- Understand why certain instructions work better than others

### Option 2: Reference the Final Prompts
- If you get stuck or want to see the exact final prompts I used
- Copy the instruction text for your own agent implementations
- Use as a starting point and modify for your specific needs

## 🎓 Learning Approach

While these complete files are provided for your convenience, I **strongly encourage** you to:

1. **Follow along with the course videos** - You'll learn much more about the process
2. **Try building the agents yourself first** - Practice makes perfect
3. **Use these files as a reference when you get stuck** - Not as a shortcut
4. **Experiment with modifying the prompts** - See how small changes affect behavior

## 🔧 Technical Notes

- These files are written for the OpenAI Agents framework
- They include proper error handling, type definitions, and best practices
- Each agent demonstrates different patterns and capabilities
- The code includes comments explaining key concepts

## 🚀 Getting Started

1. Choose an agent that interests you from the list above
2. Open the corresponding `.js` file
3. Find the `instructions:` sections to see the prompts
4. Compare with what we build in the course videos
5. Experiment and learn!

## 📝 Remember

The real value in this course comes from understanding **how** to craft effective agent instructions, not just copying the final results. These files are here to support your learning journey, not replace it.

Happy learning! 🎉

---

*Need help? Refer back to the course videos or experiment with modifications to better understand how different instructions affect agent behavior.*