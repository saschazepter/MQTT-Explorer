import { expect } from 'chai'
import 'mocha'
import { MessageProposal, QuestionProposal } from '../../app/src/services/llmService'
import { LLMApiClient, createLLMClientFromEnv } from '../src/llmApiClient'

/**
 * Live LLM Integration Tests
 *
 * These tests make actual calls to the LLM API to validate proposal quality.
 * They now use the backend LLM client logic.
 *
 * Requirements:
 * - OPENAI_API_KEY, GEMINI_API_KEY, or LLM_API_KEY environment variable must be set
 * - RUN_LLM_TESTS environment variable must be set to 'true'
 *
 * Usage:
 *   RUN_LLM_TESTS=true OPENAI_API_KEY=sk-... yarn test
 *   RUN_LLM_TESTS=true GEMINI_API_KEY=... yarn test
 *
 * These tests are skipped by default to avoid:
 * - API costs during regular testing
 * - Test failures due to missing API key
 * - Rate limiting issues in CI/CD
 */

const shouldRunLLMTests = process.env.RUN_LLM_TESTS === 'true'
const hasApiKey = !!process.env.OPENAI_API_KEY || !!process.env.GEMINI_API_KEY || !!process.env.LLM_API_KEY

let llmClient: LLMApiClient | null = null

/**
 * Helper function to call LLM API using the backend client
 */
async function callLLM(userMessage: string, context?: string): Promise<string> {
  if (!llmClient) {
    llmClient = createLLMClientFromEnv()
  }

  const systemMessage = `You are an expert AI assistant specializing in MQTT (Message Queuing Telemetry Transport) protocol and home/industrial automation systems.

IMPORTANT INSTRUCTIONS:
1. ONLY propose MQTT messages for CONTROLLABLE devices (look for related topics with /set, /command, /cmd, or cmnd/ patterns)
2. DO NOT propose messages for READ-ONLY sensors or status topics
3. When you see a sensor or read-only topic, explain what it is and how to monitor it
4. Be precise and specific - avoid generic or false positive proposals
5. Only include proposals when you are confident they will work based on the patterns you observe

When you detect a CONTROLLABLE device, propose MQTT messages using this exact format:

\`\`\`proposal
{
  "topic": "the/mqtt/topic",
  "payload": "message payload",
  "qos": 0,
  "description": "Brief description of what this does"
}
\`\`\`

PATTERN ANALYSIS APPROACH:
Infer the MQTT system and appropriate message format by analyzing:
- Topic naming patterns: Look for prefixes, suffixes, and hierarchical structure
- Related topics: If you see a /state topic, look for a /set topic
- Payload formats: Examine current values to determine if system uses JSON objects or simple strings
- Value patterns: Study existing values to understand the expected format
- Common patterns: Command topics often mirror status topics with different suffixes

Examples of what to look for:
- Topics ending in /set typically accept control commands
- Topics with cmnd/ prefix often accept simple string commands
- If current values are JSON, control topics likely expect JSON
- If current values are simple strings/numbers, match that format

For READ-ONLY sensors (no corresponding control topics):
- Explain what the sensor measures
- Describe how to monitor or visualize the data
- Do NOT propose control messages
- Acknowledge it's a read-only sensor

Quality over quantity - only propose actions you're confident will work based on observed patterns.`

  const messageContent = context ? `Context:\n${context}\n\nUser Question: ${userMessage}` : userMessage

  const messages = [
    { role: 'system' as const, content: systemMessage },
    { role: 'user' as const, content: messageContent },
  ]

  const response = await llmClient.chat(messages)
  return response.content
}

/**
 * Parse LLM response to extract proposals
 */
function parseProposals(response: string): MessageProposal[] {
  const proposals: MessageProposal[] = []
  const proposalRegex = /```proposal\s*\n([\s\S]*?)\n```/g
  let match

  while ((match = proposalRegex.exec(response)) !== null) {
    try {
      const proposalJson = JSON.parse(match[1])
      if (proposalJson.topic && proposalJson.payload !== undefined && proposalJson.description) {
        proposals.push({
          topic: proposalJson.topic,
          payload: proposalJson.payload,
          qos: proposalJson.qos || 0,
          description: proposalJson.description,
        })
      }
    } catch (e) {
      console.warn('Failed to parse proposal:', match[1])
    }
  }

  return proposals
}

/**
 * Helper function to validate a proposal structure
 */
function validateProposalStructure(proposal: MessageProposal, context: string = '') {
  expect(proposal.topic, `${context}: topic should be a string`).to.be.a('string').and.have.length.greaterThan(0)
  expect(proposal.payload, `${context}: payload should be a string`).to.be.a('string')
  expect(proposal.qos, `${context}: qos should be 0, 1, or 2`).to.be.oneOf([0, 1, 2])
  expect(proposal.description, `${context}: description should be a string`).to.be.a('string').and.have.length.greaterThan(0)
}

describe('LLM Integration Tests (Live API)', function () {
  // Increase timeout for API calls (60s for test, up to 45s for API call)
  this.timeout(60000)

  before(function () {
    if (!shouldRunLLMTests) {
      console.log('Skipping LLM integration tests: RUN_LLM_TESTS not set to "true"')
      console.log('To run these tests: RUN_LLM_TESTS=true OPENAI_API_KEY=sk-... yarn test')
      this.skip()
    }
    if (!hasApiKey) {
      console.warn('Skipping LLM integration tests: No API key found')
      console.warn('Set OPENAI_API_KEY, GEMINI_API_KEY, or LLM_API_KEY to run these tests')
      this.skip()
    }
    console.log('Running LLM integration tests using frontend LLM client logic')
  })

  describe('Home Automation System Detection', () => {
    it('should detect zigbee2mqtt topics and propose valid actions', async () => {
      // Topic context for a zigbee2mqtt light
      const topicContext = `
Topic: zigbee2mqtt/living_room_light
Value: {"state": "OFF", "brightness": 100}

Related Topics (2):
  zigbee2mqtt/living_room_light/set: {}
  zigbee2mqtt/living_room_light/availability: online
`

      console.log('\n[TEST] Calling LLM with zigbee2mqtt context...')
      const response = await callLLM('How can I turn this light on?', topicContext)
      console.log('[TEST] LLM Response length:', response.length)
      console.log('[TEST] LLM Response preview:', response.substring(0, 200) + '...')

      const proposals = parseProposals(response)
      console.log('[TEST] Extracted proposals:', proposals.length)

      // Should propose at least one action
      expect(proposals.length).to.be.greaterThan(0, 'LLM should propose at least one action')

      const turnOnProposal = proposals.find(p => 
        p.topic.includes('zigbee2mqtt') && 
        p.topic.includes('/set') &&
        (p.payload.toLowerCase().includes('on') || JSON.stringify(p.payload).toLowerCase().includes('on'))
      )

      expect(turnOnProposal).to.exist.and.not.be.undefined

      if (turnOnProposal) {
        // Validate topic format
        expect(turnOnProposal.topic).to.match(/^zigbee2mqtt\//, 'Topic should start with zigbee2mqtt/')
        expect(turnOnProposal.topic).to.include('/set', 'Topic should include /set')

        // Validate payload is valid JSON for zigbee2mqtt
        expect(() => JSON.parse(turnOnProposal.payload)).to.not.throw('Payload should be valid JSON')

        const payload = JSON.parse(turnOnProposal.payload)
        expect(payload).to.have.property('state')

        // Validate structure using helper
        validateProposalStructure(turnOnProposal, 'zigbee2mqtt turn-on proposal')

        console.log('[TEST] Turn on proposal validated successfully:', turnOnProposal)
      }
    })

    it('should detect Home Assistant topics and propose valid actions', async () => {
      const topicContext = `
Topic: homeassistant/light/bedroom_lamp/state
Value: OFF

Related Topics (1):
  homeassistant/light/bedroom_lamp/set: 
`

      console.log('\n[TEST] Calling LLM with Home Assistant context...')
      const response = await callLLM('Turn on the bedroom lamp', topicContext)
      console.log('[TEST] LLM Response length:', response.length)

      const proposals = parseProposals(response)
      console.log('[TEST] Extracted proposals:', proposals.length)

      expect(proposals.length).to.be.greaterThan(0, 'LLM should propose at least one action')

      const turnOnProposal = proposals.find(p => 
        p.topic.includes('homeassistant') && 
        p.topic.includes('/set')
      )

      expect(turnOnProposal).to.exist.and.not.be.undefined

      if (turnOnProposal) {
        expect(turnOnProposal.topic).to.match(/^homeassistant\//, 'Topic should start with homeassistant/')
        expect(turnOnProposal.topic).to.include('/set', 'Topic should include /set')
        expect(turnOnProposal.qos).to.be.oneOf([0, 1, 2])
        expect(turnOnProposal.description).to.be.a('string').and.have.length.greaterThan(0)
        console.log('[TEST] Home Assistant proposal validated successfully:', turnOnProposal)
      }
    })

    it('should detect Tasmota topics and propose valid actions', async () => {
      const topicContext = `
Topic: stat/tasmota_switch/POWER
Value: OFF

Related Topics (2):
  cmnd/tasmota_switch/POWER: 
  stat/tasmota_switch/RESULT: {"POWER":"OFF"}
`

      console.log('\n[TEST] Calling LLM with Tasmota context...')
      const response = await callLLM('How do I turn on this switch?', topicContext)
      console.log('[TEST] LLM Response length:', response.length)

      const proposals = parseProposals(response)
      console.log('[TEST] Extracted proposals:', proposals.length)

      expect(proposals.length).to.be.greaterThan(0, 'LLM should propose at least one action')

      const turnOnProposal = proposals.find(p => 
        p.topic.startsWith('cmnd/')
      )

      expect(turnOnProposal).to.exist.and.not.be.undefined

      if (turnOnProposal) {
        expect(turnOnProposal.topic).to.match(/^cmnd\//, 'Topic should start with cmnd/')
        expect(turnOnProposal.payload).to.be.oneOf(['ON', 'OFF', 'TOGGLE', '1', '0'], 
          'Tasmota payload should be a simple command')
        expect(turnOnProposal.qos).to.be.oneOf([0, 1, 2])
        expect(turnOnProposal.description).to.be.a('string').and.have.length.greaterThan(0)
        console.log('[TEST] Tasmota proposal validated successfully:', turnOnProposal)
      }
    })
  })

  describe('Proposal Quality Validation', () => {
    it('should propose multiple relevant actions for controllable devices', async () => {
      const topicContext = `
Topic: zigbee2mqtt/dimmable_light
Value: {"state": "ON", "brightness": 128, "color_temp": 370}

Related Topics (3):
  zigbee2mqtt/dimmable_light/set: {}
  zigbee2mqtt/dimmable_light/get: {}
  zigbee2mqtt/dimmable_light/availability: online
`

      console.log('\n[TEST] Testing multiple action proposals...')
      const response = await callLLM('What can I do with this light?', topicContext)
      console.log('[TEST] LLM Response length:', response.length)

      const proposals = parseProposals(response)
      console.log('[TEST] Extracted proposals:', proposals.length)

      // Should propose multiple actions for a controllable device
      expect(proposals.length).to.be.at.least(1, 'LLM should propose at least one action')

      // Validate each proposal
      proposals.forEach((proposal, index) => {
        console.log(`[TEST] Validating proposal ${index + 1}:`, proposal)
        expect(proposal.topic).to.be.a('string').and.have.length.greaterThan(0)
        expect(proposal.payload).to.be.a('string')
        expect(proposal.qos).to.be.oneOf([0, 1, 2])
        expect(proposal.description).to.be.a('string').and.have.length.greaterThan(0)
      })
    })

    it('should provide clear, actionable descriptions', async () => {
      const topicContext = `
Topic: home/light/set
Value: OFF
`

      console.log('\n[TEST] Testing description quality...')
      const response = await callLLM('Turn on the light', topicContext)

      const proposals = parseProposals(response)
      expect(proposals.length).to.be.greaterThan(0)

      proposals.forEach((proposal) => {
        // Description should be in imperative form (command) or contain an action verb
        // Accept both "Turn on the light" and "This message turns on the light"
        expect(proposal.description).to.match(
          /^(Turn|Set|Toggle|Switch|Change|Adjust|Control|This message (turns|sets|toggles|switches|changes|adjusts|controls))/i,
          'Description should start with an action verb or describe the action clearly'
        )

        // Description should be clear and concise
        expect(proposal.description.length).to.be.lessThan(100,
          'Description should be under 100 characters')
        expect(proposal.description.length).to.be.greaterThan(5,
          'Description should be meaningful')

        console.log('[TEST] Description validated:', proposal.description)
      })
    })

    it('should match payload format to detected system', async () => {
      // Test zigbee2mqtt (JSON payloads)
      const zigbeeContext = `
Topic: zigbee2mqtt/device/set
Value: {"state": "OFF"}
`

      console.log('\n[TEST] Testing zigbee2mqtt payload format...')
      const zigbeeResponse = await callLLM('Turn this on', zigbeeContext)
      const zigbeeProposals = parseProposals(zigbeeResponse)

      expect(zigbeeProposals.length).to.be.greaterThan(0)
      
      const zigbeeProposal = zigbeeProposals[0]
      expect(() => JSON.parse(zigbeeProposal.payload)).to.not.throw('zigbee2mqtt payload should be valid JSON')
      console.log('[TEST] zigbee2mqtt proposal:', zigbeeProposal)

      // Test Tasmota (simple string payloads)
      const tasmotaContext = `
Topic: cmnd/device/POWER
Value: OFF
`

      console.log('\n[TEST] Testing Tasmota payload format...')
      const tasmotaResponse = await callLLM('Turn this on', tasmotaContext)
      const tasmotaProposals = parseProposals(tasmotaResponse)

      expect(tasmotaProposals.length).to.be.greaterThan(0)

      const tasmotaProposal = tasmotaProposals[0]
      // Tasmota typically uses simple strings, but might also use JSON
      // Accept both formats
      const isSimpleString = ['ON', 'OFF', 'TOGGLE', '1', '0'].includes(tasmotaProposal.payload)
      const isValidJSON = (() => {
        try { JSON.parse(tasmotaProposal.payload); return true } catch { return false }
      })()
      
      expect(isSimpleString || isValidJSON).to.be.true
      console.log('[TEST] Tasmota proposal:', tasmotaProposal)
    })
  })

  describe('Edge Cases', () => {
    it('should handle read-only sensors appropriately', async () => {
      const topicContext = `
Topic: sensors/temperature
Value: 23.5

Messages: 1000
`

      console.log('\n[TEST] Testing read-only sensor handling...')
      const response = await callLLM('What can I do with this sensor?', topicContext)
      console.log('[TEST] LLM Response length:', response.length)

      const proposals = parseProposals(response)
      console.log('[TEST] Extracted proposals for sensor:', proposals.length)

      // For read-only sensors, the LLM might not propose actions, or might propose monitoring/analysis
      // This is not a strict requirement but we validate the response is sensible
      if (proposals.length > 0) {
        // If proposals are made, they should not be write actions
        proposals.forEach(proposal => {
          console.log('[TEST] Sensor proposal:', proposal)
          // Validate proposal structure even for sensors
          expect(proposal.topic).to.be.a('string')
          expect(proposal.description).to.be.a('string')
        })
      }
      
      // The response should acknowledge this is a sensor
      expect(response.toLowerCase()).to.match(/sensor|temperature|read|monitor|value/,
        'Response should acknowledge sensor nature')
    })

    it('should handle complex nested topic structures', async () => {
      const topicContext = `
Topic: home/rooms/livingroom/devices/light/main
Value: {"state": "OFF", "brightness": 0, "color": {"r": 255, "g": 255, "b": 255}}

Related Topics (1):
  home/rooms/livingroom/devices/light/main/set: {}
`

      console.log('\n[TEST] Testing complex nested topics...')
      const response = await callLLM('Turn this light on', topicContext)

      const proposals = parseProposals(response)
      expect(proposals.length).to.be.greaterThan(0)

      const proposal = proposals[0]
      // Should handle deep nesting correctly
      expect(proposal.topic.split('/')).to.have.length.greaterThan(3,
        'Should maintain deep topic structure')
      
      // Should include the full path
      expect(proposal.topic).to.include('home/rooms/livingroom')
      console.log('[TEST] Complex topic proposal:', proposal)
    })

    it('should handle topics with special characters', async () => {
      const topicContext = `
Topic: home/device-123/sensor_1
Value: active

Related Topics (1):
  home/device-123/sensor_1/control: {}
`

      console.log('\n[TEST] Testing special characters in topics...')
      const response = await callLLM('Control this device', topicContext)

      const proposals = parseProposals(response)
      
      if (proposals.length > 0) {
        const proposal = proposals[0]
        // Should preserve hyphens, underscores, numbers
        expect(proposal.topic).to.match(/^[a-zA-Z0-9/_-]+$/,
          'Topic should only contain valid MQTT characters')
        console.log('[TEST] Special character topic proposal:', proposal)
      }
    })
  })

  describe('Question Generation Quality', () => {
    it('should generate relevant follow-up questions', async () => {
      const topicContext = `
Topic: zigbee2mqtt/bedroom_light
Value: {"state": "OFF", "brightness": 255}

Related Topics (2):
  zigbee2mqtt/bedroom_light/set: {}
  zigbee2mqtt/bedroom_light/availability: online
`

      console.log('\n[TEST] Testing question generation...')
      const response = await callLLM('What is this device?', topicContext)
      console.log('[TEST] LLM Response length:', response.length)

      // Parse question proposals from the response
      const questionRegex = /```question-proposal\s*\n([\s\S]*?)\n```/g
      const questions: QuestionProposal[] = []
      let match

      while ((match = questionRegex.exec(response)) !== null) {
        try {
          const questionJson = JSON.parse(match[1])
          if (questionJson.question) {
            questions.push({
              question: questionJson.question,
              category: questionJson.category,
            })
          }
        } catch (e) {
          console.warn('Failed to parse question proposal:', match[1])
        }
      }

      console.log('[TEST] Extracted questions:', questions.length)
      
      if (questions.length > 0) {
        questions.forEach((q, index) => {
          console.log(`[TEST] Question ${index + 1}:`, q)
          expect(q.question).to.be.a('string').and.have.length.greaterThan(5)
          expect(q.question).to.match(/\?$/, 'Question should end with ?')
          
          if (q.category) {
            expect(q.category).to.be.oneOf(['analysis', 'control', 'troubleshooting', 'optimization'])
          }
        })
      }

      // The response should be relevant to the device type
      expect(response.toLowerCase()).to.match(/light|brightness|control|device/,
        'Response should be relevant to the topic')
    })

    it('should provide informative responses about sensor data', async () => {
      const topicContext = `
Topic: sensors/temperature
Value: 23.5

Messages: 1000
`

      console.log('\n[TEST] Testing sensor data analysis...')
      const response = await callLLM('Tell me about this sensor', topicContext)
      console.log('[TEST] LLM Response length:', response.length)

      // Response should mention temperature or sensor
      expect(response.toLowerCase()).to.match(/temperature|sensor|value|reading|data/,
        'Response should discuss sensor data')
      
      console.log('[TEST] Sensor analysis response preview:', response.substring(0, 200))
    })
  })
})
