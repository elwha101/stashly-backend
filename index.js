const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Stashly API is running! 🐘' });
});

// Parse voice input into stash data
app.post('/parse-stash', async (req, res) => {
  try {
    const { transcript } = req.body;

    if (!transcript) {
      return res.status(400).json({ error: 'No transcript provided' });
    }

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `Extract gift stashing information from this text and return ONLY a JSON object with no other text, markdown, or explanation.

Required JSON format:
{"item": "string", "location": "string", "person": "string", "occasion": "string", "occasionDate": "string"}

Rules:
- item: The gift or item being stashed
- location: Where it's being stashed
- person: Who it's for
- occasion: Must be one of: Birthday, Christmas, Anniversary, Valentine's, Mother's Day, Father's Day, Other
- occasionDate: Date in YYYY-MM-DD format, or "" if not mentioned
- Use "" for any field you cannot determine

Text: "${transcript}"

Respond with ONLY the JSON object, nothing else:`
        }
      ],
    });

    // Extract the text response
    const responseText = message.content[0].text;
    console.log('Claude response:', responseText); // Debug logging
    
    // Parse the JSON response
    let parsedData;
    try {
      // First try direct parse
      parsedData = JSON.parse(responseText);
    } catch (parseError) {
      // Try to extract JSON from the response if it has extra text
      const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        try {
          parsedData = JSON.parse(jsonMatch[0]);
        } catch (e) {
          console.error('Failed to parse extracted JSON:', jsonMatch[0]);
          throw new Error('Could not parse response as JSON');
        }
      } else {
        console.error('No JSON found in response:', responseText);
        throw new Error('Could not parse response as JSON');
      }
    }

    res.json({
      success: true,
      data: {
        item: parsedData.item || '',
        location: parsedData.location || '',
        person: parsedData.person || '',
        occasion: parsedData.occasion || 'Other',
        occasionDate: parsedData.occasionDate || '',
      }
    });

  } catch (error) {
    console.error('Error parsing stash:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to parse voice input',
      details: error.message 
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🐘 Stashly API running on port ${PORT}`);
});
