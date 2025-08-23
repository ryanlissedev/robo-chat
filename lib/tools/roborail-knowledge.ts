import { tool } from 'ai';
import { z } from 'zod';

// RoboRail-specific knowledge base and technical information
const ROBORAIL_KNOWLEDGE_BASE = {
  errorCodes: {
    E001: 'Emergency stop activated. Check all safety systems and clear any obstructions before resetting.',
    E002: 'Hydraulic pressure too low. Check hydraulic fluid levels and pump operation.',
    E003: 'Cutting torch ignition failure. Check gas supply and torch tip condition.',
    E004: 'Rail position sensor error. Verify sensor connections and calibration.',
    E005: 'Temperature overload. Allow system to cool before resuming operation.',
  },
  safetyProtocols: {
    preOperation: [
      'Perform visual inspection of all safety guards',
      'Check emergency stop buttons functionality',
      'Verify proper PPE is worn (safety glasses, steel-toed boots, gloves)',
      'Ensure work area is clear of personnel',
      'Check gas connections for leaks',
      'Verify rail is properly secured and aligned',
    ],
    operation: [
      'Maintain safe distance from cutting area',
      'Monitor cutting process continuously',
      'Keep fire extinguisher readily available',
      'Never leave machine unattended during operation',
      'Report any unusual sounds or vibrations immediately',
    ],
    postOperation: [
      'Turn off gas supply',
      'Allow cutting head to cool completely',
      'Clean work area of metal debris',
      'Perform post-operation inspection',
      'Log any maintenance issues',
    ],
  },
  specifications: {
    maxCuttingThickness: '150mm steel',
    railLength: '12 meters maximum',
    powerRequirements: '480V 3-phase, 100A',
    cuttingSpeed: '100-800 mm/min depending on material',
    accuracy: '±0.5mm',
    gasConsumption: 'Oxygen: 2-8 m³/h, Propane: 0.8-3.2 m³/h',
  },
  maintenance: {
    daily: [
      'Check hydraulic fluid level',
      'Inspect cutting torch and tips',
      'Clean rail guides and tracks',
      'Verify emergency stops',
      'Check gas hose connections',
    ],
    weekly: [
      'Lubricate all moving parts',
      'Check belt tension',
      'Inspect electrical connections',
      'Clean and inspect filters',
      'Test safety systems',
    ],
    monthly: [
      'Replace cutting torch tips if worn',
      'Check hydraulic seals',
      'Calibrate position sensors',
      'Update cutting programs if needed',
      'Professional inspection recommended',
    ],
  },
  troubleshooting: {
    poorCutQuality: {
      causes: [
        'Worn cutting tip',
        'Incorrect gas pressure',
        'Wrong cutting speed',
        'Dirty or damaged rail surface',
        'Improper torch height',
      ],
      solutions: [
        'Replace cutting tip',
        'Adjust gas pressures per manual',
        'Reduce cutting speed',
        'Clean rail surface',
        'Recalibrate torch height sensor',
      ],
    },
    machineStops: {
      causes: [
        'Emergency stop activated',
        'Safety interlock triggered',
        'Power supply issue',
        'Software error',
        'Mechanical obstruction',
      ],
      solutions: [
        'Check and reset emergency stops',
        'Verify all safety guards in place',
        'Check power connections',
        'Restart control system',
        'Clear any obstructions',
      ],
    },
  },
  contacts: {
    support: {
      phone: '+31 (0)573 408 408',
      email: 'support@hgg-group.com',
      website: 'https://www.hgg-group.com',
      hours: 'Monday-Friday 8:00-17:00 CET',
    },
    emergency: {
      phone: '+31 (0)573 408 400',
      availability: '24/7 for critical issues',
    },
  },
};

export const roborailKnowledgeTool = tool({
  description:
    'Access RoboRail-specific technical knowledge, error codes, safety protocols, and troubleshooting information',
  inputSchema: z.object({
    query_type: z
      .enum([
        'error_code',
        'safety_protocol',
        'specification',
        'maintenance',
        'troubleshooting',
        'contact_info',
        'general',
      ])
      .describe('Type of information requested'),
    specific_query: z.string().describe('Specific question or error code'),
    safety_level: z
      .enum(['basic', 'detailed'])
      .optional()
      .default('basic')
      .describe('Level of safety information detail'),
  }),
  execute: async ({ query_type, specific_query, safety_level }) => {
    try {
      const query = specific_query.toLowerCase();
      let response: Record<string, unknown> = {};

      switch (query_type) {
        case 'error_code': {
          const errorCode = query.match(/[eE]\d{3}/)?.[0]?.toUpperCase();
          if (
            errorCode &&
            ROBORAIL_KNOWLEDGE_BASE.errorCodes[
              errorCode as keyof typeof ROBORAIL_KNOWLEDGE_BASE.errorCodes
            ]
          ) {
            response = {
              error_code: errorCode,
              description:
                ROBORAIL_KNOWLEDGE_BASE.errorCodes[
                  errorCode as keyof typeof ROBORAIL_KNOWLEDGE_BASE.errorCodes
                ],
              safety_note:
                '⚠️ Always follow safety protocols when addressing error conditions.',
              next_steps: [
                'Review the error description carefully',
                'Ensure machine is in safe state before troubleshooting',
                'Contact HGG support if error persists',
              ],
            };
          } else {
            response = {
              message: 'Error code not found in knowledge base',
              available_codes: Object.keys(ROBORAIL_KNOWLEDGE_BASE.errorCodes),
              recommendation:
                'Please verify the error code or contact HGG support',
            };
          }
          break;
        }

        case 'safety_protocol': {
          const safetyInfo = ROBORAIL_KNOWLEDGE_BASE.safetyProtocols;
          response = {
            safety_protocols: safetyInfo,
            critical_warning:
              '⚠️ SAFETY FIRST: Never operate the RoboRail without following all safety protocols',
            ppe_requirements:
              'Safety glasses, steel-toed boots, heat-resistant gloves, flame-resistant clothing',
            emergency_contact: ROBORAIL_KNOWLEDGE_BASE.contacts.emergency,
          };
          break;
        }

        case 'specification':
          response = {
            specifications: ROBORAIL_KNOWLEDGE_BASE.specifications,
            note: 'Specifications may vary by model. Consult your specific manual for exact values.',
          };
          break;

        case 'maintenance':
          response = {
            maintenance_schedule: ROBORAIL_KNOWLEDGE_BASE.maintenance,
            important_note:
              '⚠️ Regular maintenance is critical for safe operation and optimal performance',
            recommendation:
              'Keep a maintenance log and follow the schedule strictly',
          };
          break;

        case 'troubleshooting': {
          let troubleshootingInfo = null;
          if (query.includes('cut') || query.includes('quality')) {
            troubleshootingInfo =
              ROBORAIL_KNOWLEDGE_BASE.troubleshooting.poorCutQuality;
          } else if (query.includes('stop') || query.includes('halt')) {
            troubleshootingInfo =
              ROBORAIL_KNOWLEDGE_BASE.troubleshooting.machineStops;
          }

          response = troubleshootingInfo
            ? {
                issue: query,
                troubleshooting: troubleshootingInfo,
                safety_reminder:
                  '⚠️ Always ensure machine is in safe state before troubleshooting',
                escalation:
                  'If issue persists, contact HGG support immediately',
              }
            : {
                message: 'Specific troubleshooting information not found',
                general_steps: [
                  'Check error display for codes',
                  'Review recent operational changes',
                  'Verify all safety systems',
                  'Consult operation manual',
                  'Contact HGG support if needed',
                ],
              };
          break;
        }

        case 'contact_info':
          response = {
            support_contacts: ROBORAIL_KNOWLEDGE_BASE.contacts,
            recommendation:
              'For technical issues, have your machine serial number and error codes ready when calling',
          };
          break;

        default:
          response = {
            message: 'General RoboRail information available',
            available_topics: [
              'Error codes (E001-E005)',
              'Safety protocols',
              'Technical specifications',
              'Maintenance schedules',
              'Troubleshooting guides',
              'Contact information',
            ],
            suggestion:
              'Please specify what type of information you need about the RoboRail',
          };
      }

      return {
        success: true,
        query_type,
        specific_query,
        safety_level,
        data: response,
        safety_notice:
          safety_level === 'detailed'
            ? '⚠️ CRITICAL: Always prioritize safety. If uncertain about any procedure, stop and contact HGG support.'
            : '⚠️ Follow all safety protocols',
        support_info: ROBORAIL_KNOWLEDGE_BASE.contacts.support,
      };
    } catch (error) {
      return {
        success: false,
        query_type,
        specific_query,
        error:
          error instanceof Error
            ? error.message
            : 'Failed to access RoboRail knowledge base',
        fallback: 'Contact HGG support for immediate assistance',
      };
    }
  },
});

// Enhanced error code lookup function
export function lookupErrorCode(code: string): string | null {
  const normalizedCode = code.toUpperCase().match(/E\d{3}/)?.[0];
  if (
    normalizedCode &&
    ROBORAIL_KNOWLEDGE_BASE.errorCodes[
      normalizedCode as keyof typeof ROBORAIL_KNOWLEDGE_BASE.errorCodes
    ]
  ) {
    return ROBORAIL_KNOWLEDGE_BASE.errorCodes[
      normalizedCode as keyof typeof ROBORAIL_KNOWLEDGE_BASE.errorCodes
    ];
  }
  return null;
}

// Safety protocol checker
export function getSafetyProtocols(
  phase: 'preOperation' | 'operation' | 'postOperation'
): string[] {
  return ROBORAIL_KNOWLEDGE_BASE.safetyProtocols[phase] || [];
}

// Quick specification lookup
export function getSpecification(
  spec: keyof typeof ROBORAIL_KNOWLEDGE_BASE.specifications
): string | undefined {
  return ROBORAIL_KNOWLEDGE_BASE.specifications[spec];
}
