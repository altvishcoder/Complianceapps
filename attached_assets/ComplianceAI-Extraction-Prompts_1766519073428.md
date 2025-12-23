# ComplianceAI - AI Extraction Prompts

These are the actual prompts used by the application to extract data from compliance certificates using GPT-4o.

---

## Document Classification Prompt

Used to identify the type of certificate before extraction.

```
Identify the type of UK compliance certificate in this document.

Look for these indicators:

GAS_SAFETY (CP12):
- "Landlord Gas Safety Record"
- "Gas Safe" logo or registration number
- "CP12" reference
- Gas appliance safety checks

EICR:
- "Electrical Installation Condition Report"
- "EICR" in title
- C1/C2/C3/FI observation codes
- "Satisfactory/Unsatisfactory" assessment

EPC:
- "Energy Performance Certificate"
- Energy efficiency rating A-G
- SAP rating
- Recommendations table

FIRE_RISK_ASSESSMENT:
- "Fire Risk Assessment"
- "FRA" reference
- Fire safety measures
- Risk ratings

LEGIONELLA:
- "Legionella Risk Assessment"
- "Water Hygiene"
- Hot/cold water system checks

ASBESTOS:
- "Asbestos Survey"
- "Asbestos Register"
- Material Assessment

Return JSON only:
{
  "certificateType": "GAS_SAFETY | EICR | EPC | FIRE_RISK_ASSESSMENT | LEGIONELLA | ASBESTOS | OTHER",
  "confidence": 0.0-1.0,
  "indicators": ["list of indicators found"]
}
```

---

## Gas Safety Certificate (CP12) Extraction Prompt

```
You are extracting data from a UK Gas Safety Certificate (CP12 / Landlord Gas Safety Record).

CONTEXT:
- This is a legal document required annually under Gas Safety (Installation and Use) Regulations 1998
- Must be issued by a Gas Safe registered engineer
- Gas Safe registration numbers are exactly 7 digits
- Expiry is always 12 months from inspection date

REQUIRED FIELDS:

1. CERTIFICATE DETAILS
   - Certificate/Record number (usually top right corner)

2. PROPERTY
   - Full address including postcode
   - Postcode must be valid UK format

3. LANDLORD/OWNER
   - Name
   - Address (if shown)

4. ENGINEER (who did the inspection)
   - Full name
   - Gas Safe ID number (CRITICAL - must be 7 digits)
   - Signature present: yes/no

5. CONTRACTOR/EMPLOYER
   - Company name
   - Gas Safe licence number
   - Address and phone (if shown)

6. DATES
   - Inspection date (the date work was carried out)
   - Next check due / Expiry date (should be 12 months from inspection)
   - Convert all dates to YYYY-MM-DD format

7. APPLIANCES (for each gas appliance)
   - Location (Kitchen, Utility, Living Room, etc.)
   - Type (Boiler, Cooker, Gas Fire, Water Heater, Hob)
   - Make/Manufacturer
   - Model
   - Flue type (Open Flue, Room Sealed, Flueless, N/A)
   - Test Results:
     * Operating pressure/heat input
     * Safety device operation: correct/incorrect
     * Ventilation: satisfactory/unsatisfactory
     * Visual condition of pipework: Pass/Fail
     * Flue flow test: Pass/Fail/N/A
     * Spillage test: Pass/Fail/N/A
   - Appliance safe to use: Yes/No

8. OVERALL OUTCOME
   Determine from the certificate:
   - SATISFACTORY: All appliances safe, no defects noted
   - AT_RISK (AR): Some defects but not immediately dangerous, advice given
   - IMMEDIATELY_DANGEROUS (ID): Serious risk, appliance should be disconnected
   - NOT_TO_CURRENT_STANDARD (NCS): Safe but doesn't meet current regulations

9. DEFECTS (if any noted)
   For each defect:
   - Which appliance (by location/type)
   - Description of defect
   - Classification: ID, AR, or NCS
   - Action taken by engineer
   - Remedial action required: yes/no

OUTPUT FORMAT:
{
  "certificateNumber": "string or null",
  "propertyAddress": {
    "line1": "string (required)",
    "line2": "string or null",
    "city": "string or null",
    "postcode": "string (required, UK format)"
  },
  "landlord": {
    "name": "string",
    "address": "string or null"
  },
  "inspectionDate": "YYYY-MM-DD (required)",
  "expiryDate": "YYYY-MM-DD (required)",
  "engineer": {
    "name": "string (required)",
    "gasSafeNumber": "string (required, 7 digits)",
    "signaturePresent": true/false
  },
  "contractor": {
    "name": "string",
    "gasSafeNumber": "string or null",
    "address": "string or null",
    "telephone": "string or null"
  },
  "appliances": [
    {
      "location": "string",
      "type": "string",
      "make": "string",
      "model": "string",
      "flueType": "Open Flue | Room Sealed | Flueless | N/A",
      "operatingPressure": "string or null",
      "safetyDeviceCorrect": true/false,
      "ventilationSatisfactory": true/false,
      "visualCondition": "Pass | Fail",
      "flueFlowTest": "Pass | Fail | N/A",
      "spillageTest": "Pass | Fail | N/A",
      "applianceSafe": true/false
    }
  ],
  "overallOutcome": "SATISFACTORY | AT_RISK | IMMEDIATELY_DANGEROUS | NOT_TO_CURRENT_STANDARD",
  "defects": [
    {
      "applianceLocation": "string",
      "applianceType": "string",
      "description": "string",
      "classification": "ID | AR | NCS",
      "actionTaken": "string",
      "remedialRequired": true/false
    }
  ],
  "confidence": 0.0-1.0
}

VALIDATION RULES:
- Gas Safe numbers MUST be exactly 7 digits. If format is wrong, set confidence below 0.5
- If expiry date is not shown, calculate as inspection date + 12 months
- UK postcodes match pattern: AA9A 9AA, A9A 9AA, A9 9AA, A99 9AA, AA9 9AA, AA99 9AA
- Dates must be valid and inspection date should be in the past
- At least one appliance should be listed
- If any field is unclear or missing, include as null and reduce confidence

Return ONLY valid JSON, no markdown formatting or explanations.
```

---

## EICR (Electrical Installation Condition Report) Extraction Prompt

```
You are extracting data from a UK Electrical Installation Condition Report (EICR).

CONTEXT:
- Required every 5 years for social housing (can be up to 10 years for owner-occupied)
- Must be completed by a qualified electrician registered with NICEIC, NAPIT, or similar
- Uses coding system: C1 (Danger), C2 (Potentially Dangerous), C3 (Improvement), FI (Further Investigation)
- An installation with ANY C1 or C2 observations is UNSATISFACTORY

REQUIRED FIELDS:

1. REPORT DETAILS
   - Report reference number
   - Date of inspection
   - Next inspection due date (or recommended interval)

2. PROPERTY
   - Full address with postcode
   - Occupier name (if shown)

3. CLIENT/LANDLORD
   - Name
   - Address

4. CONTRACTOR
   - Company name
   - Address
   - Registration number (NICEIC/NAPIT/etc.)
   - Telephone

5. INSPECTOR
   - Name
   - Personal registration number
   - Signature present: yes/no

6. INSTALLATION DETAILS
   - Estimated age of installation
   - Evidence of previous inspection: yes/no
   - Date of previous inspection (if known)
   - Type of supply (TN-S, TN-C-S, TT, etc.)
   - Number of circuits
   - Ze at origin (if shown)
   - Prospective fault current (if shown)

7. EXTENT OF INSPECTION
   - Full/Sampling/Limitation
   - Any limitations noted

8. OVERALL ASSESSMENT
   - SATISFACTORY: No C1 or C2 observations
   - UNSATISFACTORY: One or more C1 or C2 observations

9. OBSERVATIONS (CRITICAL - extract ALL)
   For each observation noted:
   - Item/Section number (e.g., "4.1", "5.6a", "7.1")
   - Full description of the issue
   - Code: C1, C2, C3, or FI
   - Location/Circuit (if specified)

10. RECOMMENDATIONS
    - Recommended interval until next inspection (months)
    - Any specific recommendations

OUTPUT FORMAT:
{
  "reportNumber": "string or null",
  "propertyAddress": {
    "line1": "string (required)",
    "line2": "string or null",
    "city": "string or null",
    "postcode": "string (required)"
  },
  "occupier": "string or null",
  "client": {
    "name": "string",
    "address": "string or null"
  },
  "inspectionDate": "YYYY-MM-DD (required)",
  "nextInspectionDate": "YYYY-MM-DD",
  "recommendedIntervalMonths": 60,
  "inspector": {
    "name": "string (required)",
    "registrationNumber": "string (required)",
    "registrationScheme": "NICEIC | NAPIT | ELECSA | STROMA | Other",
    "signaturePresent": true/false
  },
  "contractor": {
    "name": "string",
    "address": "string or null",
    "telephone": "string or null",
    "registrationNumber": "string or null"
  },
  "installation": {
    "estimatedAge": "string or null",
    "previousInspection": true/false,
    "previousInspectionDate": "YYYY-MM-DD or null",
    "supplyType": "string",
    "circuits": "number or null",
    "zeAtOrigin": "string or null"
  },
  "extentOfInspection": "Full | Sampling | Limited",
  "limitations": ["list of any limitations"],
  "overallAssessment": "SATISFACTORY | UNSATISFACTORY",
  "observations": [
    {
      "itemNumber": "string (e.g., '4.1')",
      "description": "string (full description)",
      "code": "C1 | C2 | C3 | FI",
      "location": "string or null"
    }
  ],
  "c1Count": 0,
  "c2Count": 0,
  "c3Count": 0,
  "fiCount": 0,
  "recommendations": ["list of recommendations"],
  "confidence": 0.0-1.0
}

VALIDATION RULES:
- If there are ANY C1 or C2 observations, overallAssessment MUST be UNSATISFACTORY
- Count observations by code and ensure counts match
- For social housing, recommended interval is typically 60 months (5 years)
- Extract ALL observations, not just a summary
- If nextInspectionDate not shown, calculate from inspectionDate + recommendedIntervalMonths
- Registration schemes: NICEIC, NAPIT, ELECSA, STROMA are most common

OBSERVATION CODES MEANING:
- C1: Danger present - Risk of injury. Immediate remedial action required.
- C2: Potentially dangerous - Urgent remedial action required.
- C3: Improvement recommended - Not dangerous but could be improved.
- FI: Further investigation required - Could not fully inspect, needs more work to assess.

Return ONLY valid JSON, no markdown formatting or explanations.
```

---

## EPC (Energy Performance Certificate) Extraction Prompt

```
You are extracting data from a UK Energy Performance Certificate (EPC).

CONTEXT:
- Valid for 10 years from issue date
- Properties must have minimum rating of E for letting (some exemptions apply)
- Ratings go from A (most efficient) to G (least efficient)
- Includes current rating and potential rating with improvements

REQUIRED FIELDS:

1. CERTIFICATE DETAILS
   - Certificate reference number (RRN - usually starts with numbers)
   - Date of assessment
   - Valid until date (10 years from assessment)

2. PROPERTY
   - Full address with postcode
   - Property type (Flat, House, Bungalow, Maisonette)
   - Total floor area (m²)
   - Number of habitable rooms (if shown)

3. ASSESSOR
   - Name
   - Accreditation number
   - Accreditation scheme (Elmhurst, Stroma, ECMK, etc.)

4. ENERGY RATINGS
   - Current energy efficiency rating (1-100)
   - Current energy efficiency band (A-G)
   - Potential energy efficiency rating
   - Potential energy efficiency band
   - Current environmental impact rating (1-100)
   - Potential environmental impact rating

5. ENERGY COSTS
   - Current estimated energy costs per year
   - Potential energy costs per year
   - Potential savings per year

6. RECOMMENDATIONS (if shown)
   - List of improvement measures
   - Each with indicative cost and typical savings

OUTPUT FORMAT:
{
  "certificateNumber": "string (required)",
  "propertyAddress": {
    "line1": "string (required)",
    "line2": "string or null",
    "city": "string or null",
    "postcode": "string (required)"
  },
  "assessmentDate": "YYYY-MM-DD (required)",
  "expiryDate": "YYYY-MM-DD (required)",
  "propertyType": "Flat | House | Bungalow | Maisonette | Other",
  "floorArea": 0.0,
  "habitableRooms": 0,
  "assessor": {
    "name": "string",
    "accreditationNumber": "string",
    "accreditationScheme": "string"
  },
  "currentRating": {
    "score": 0,
    "band": "A | B | C | D | E | F | G"
  },
  "potentialRating": {
    "score": 0,
    "band": "A | B | C | D | E | F | G"
  },
  "environmentalImpact": {
    "current": 0,
    "potential": 0
  },
  "energyCosts": {
    "current": 0,
    "potential": 0,
    "savings": 0
  },
  "recommendations": [
    {
      "measure": "string",
      "indicativeCost": "string",
      "typicalSavings": "string"
    }
  ],
  "confidence": 0.0-1.0
}

VALIDATION RULES:
- Rating bands: A (92-100), B (81-91), C (69-80), D (55-68), E (39-54), F (21-38), G (1-20)
- Expiry date should be exactly 10 years from assessment date
- Floor area should be reasonable (typically 20-500 m² for residential)
- Certificate numbers often start with digits

Return ONLY valid JSON, no markdown formatting or explanations.
```

---

## Fire Risk Assessment Extraction Prompt

```
You are extracting data from a UK Fire Risk Assessment (FRA).

CONTEXT:
- Required for all blocks/buildings with common areas under the Regulatory Reform (Fire Safety) Order 2005
- Should be reviewed annually and after any significant changes
- Responsible person is usually the landlord/housing association
- Must be carried out by a competent person

REQUIRED FIELDS:

1. ASSESSMENT DETAILS
   - Assessment date
   - Review date / Next assessment due
   - Assessor name and qualifications
   - Reference number (if any)

2. PREMISES
   - Building name/address
   - Postcode
   - Type of premises
   - Number of floors
   - Number of dwellings/units
   - Sleeping accommodation: yes/no

3. RESPONSIBLE PERSON
   - Name
   - Organisation
   - Contact details

4. RISK LEVEL
   - Overall risk rating (Trivial, Low, Moderate, High, Extreme)
   - Fire hazards identified
   - People at risk

5. FIRE SAFETY MEASURES
   - Fire detection (type and coverage)
   - Fire alarm system (type)
   - Emergency lighting
   - Fire doors (condition)
   - Means of escape
   - Fire fighting equipment
   - Signage

6. ACTIONS REQUIRED
   For each action:
   - Description
   - Priority (Immediate, High, Medium, Low)
   - Target completion date
   - Responsible person

OUTPUT FORMAT:
{
  "assessmentDate": "YYYY-MM-DD",
  "nextReviewDate": "YYYY-MM-DD",
  "referenceNumber": "string or null",
  "assessor": {
    "name": "string",
    "qualifications": "string or null",
    "company": "string or null"
  },
  "premises": {
    "name": "string",
    "address": "string",
    "postcode": "string",
    "type": "string",
    "floors": 0,
    "units": 0,
    "sleepingAccommodation": true/false
  },
  "responsiblePerson": {
    "name": "string",
    "organisation": "string",
    "contact": "string or null"
  },
  "riskLevel": "Trivial | Low | Moderate | High | Extreme",
  "hazardsIdentified": ["list of hazards"],
  "peopleAtRisk": ["list of people/groups at risk"],
  "fireSafetyMeasures": {
    "fireDetection": "string (type and coverage)",
    "fireAlarm": "string (type)",
    "emergencyLighting": "string (present/adequate)",
    "fireDoors": "string (condition)",
    "meansOfEscape": "string (adequacy)",
    "firefightingEquipment": "string (type and location)",
    "signage": "string (adequate/inadequate)"
  },
  "actions": [
    {
      "description": "string",
      "priority": "Immediate | High | Medium | Low",
      "targetDate": "YYYY-MM-DD or null",
      "responsiblePerson": "string or null"
    }
  ],
  "confidence": 0.0-1.0
}

Return ONLY valid JSON, no markdown formatting or explanations.
```

---

## Generic Certificate Extraction Prompt

For certificate types not specifically covered above:

```
You are extracting data from a UK compliance certificate for social housing.

Extract all relevant information including:

1. CERTIFICATE IDENTIFICATION
   - Type of certificate
   - Reference/Certificate number
   - Date of issue/inspection
   - Expiry date or next due date

2. PROPERTY
   - Full address
   - Postcode

3. ISSUER/INSPECTOR
   - Name
   - Company
   - Registration/Accreditation number
   - Contact details

4. CLIENT/LANDLORD
   - Name
   - Organisation

5. RESULTS/FINDINGS
   - Overall outcome (Pass/Fail/Satisfactory/Unsatisfactory)
   - Any issues or defects found
   - Recommendations

6. ACTIONS REQUIRED
   - Any remedial work needed
   - Priority/Urgency
   - Target dates

OUTPUT FORMAT:
{
  "certificateType": "string (your best identification)",
  "certificateNumber": "string or null",
  "propertyAddress": {
    "line1": "string",
    "line2": "string or null",
    "city": "string or null",
    "postcode": "string"
  },
  "issueDate": "YYYY-MM-DD",
  "expiryDate": "YYYY-MM-DD or null",
  "inspector": {
    "name": "string",
    "company": "string or null",
    "registrationNumber": "string or null"
  },
  "client": {
    "name": "string",
    "organisation": "string or null"
  },
  "outcome": "string (overall result)",
  "findings": ["list of key findings"],
  "actionsRequired": [
    {
      "description": "string",
      "priority": "string",
      "dueDate": "string or null"
    }
  ],
  "confidence": 0.0-1.0
}

Return ONLY valid JSON, no markdown formatting or explanations.
```

---

## Confidence Scoring Guidelines

The AI should score confidence based on:

| Factor | Impact |
|--------|--------|
| All required fields extracted | +0.0 (baseline) |
| Missing required field | -0.10 per field |
| Invalid format (e.g., Gas Safe not 7 digits) | -0.20 |
| Date parsing issues | -0.15 |
| Postcode format invalid | -0.10 |
| Document quality poor | -0.15 |
| Handwritten sections | -0.10 |
| Multiple validation errors | -0.10 per error |
| Conflicting information | -0.15 |

**Thresholds:**
- ≥ 0.85: Auto-approve (high confidence)
- 0.70 - 0.84: Needs human review
- < 0.70: Low confidence, definitely needs review
- < 0.50: Consider using fallback extraction (Document AI)

---

© 2025 LASHAN Digital
