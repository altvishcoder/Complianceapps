# ComplianceAI Chatbot - Replit Implementation
## 5-Layer Cost-Optimized Architecture

---

## Replit-Specific Configuration

### Project Structure
```
complianceai-chatbot/
├── main.py                     # FastAPI entry point
├── config.py                   # Replit Secrets integration
├── requirements.txt
├── .replit                     # Replit run configuration
├── replit.nix                  # System dependencies
│
├── layers/
│   ├── __init__.py
│   ├── intent_classifier.py    # Layer 0: Query routing
│   ├── faq_cache.py            # Layer 1: Semantic FAQ
│   ├── database_queries.py     # Layer 2: Replit PostgreSQL
│   ├── llm_handler.py          # Layer 3: Claude + RAG
│   └── response_enhancer.py    # Layer 4: Guardrails
│
└── data/
    └── faq_database.json       # FAQ content
```

---

## File: `.replit`

```toml
run = "python main.py"
entrypoint = "main.py"
modules = ["python-3.11"]

[nix]
channel = "stable-24_05"

[deployment]
run = ["sh", "-c", "python main.py"]
deploymentTarget = "cloudrun"

[[ports]]
localPort = 8000
externalPort = 80
```

---

## File: `replit.nix`

```nix
{ pkgs }: {
  deps = [
    pkgs.python311
    pkgs.python311Packages.pip
    pkgs.postgresql
  ];
}
```

---

## File: `requirements.txt`

```
fastapi==0.109.0
uvicorn==0.27.0
anthropic==0.18.1
asyncpg==0.29.0
numpy==1.26.3
scikit-learn==1.4.0
```

Note: Using scikit-learn for TF-IDF instead of sentence-transformers (lighter for Replit's free tier).

---

## File: `config.py`

```python
"""
Configuration using Replit Secrets
Set these in the Secrets tab (padlock icon):
- ANTHROPIC_API_KEY
- DATABASE_URL (auto-set if using Replit PostgreSQL)
"""
import os

class Config:
    # Replit Secrets
    ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
    DATABASE_URL = os.environ.get("DATABASE_URL", "")
    
    # LLM Settings
    LLM_MODEL = "claude-3-5-haiku-20241022"
    LLM_MAX_TOKENS = 512
    LLM_TEMPERATURE = 0.3
    
    # Thresholds
    FAQ_SIMILARITY_THRESHOLD = 0.45  # TF-IDF threshold (lower than embeddings)
    
    # Rate Limiting
    MAX_LLM_CALLS_PER_MINUTE = 20

config = Config()
```

---

## File: `layers/__init__.py`

```python
from .intent_classifier import intent_classifier, QueryIntent
from .faq_cache import faq_cache
from .database_queries import db_handler
from .llm_handler import llm_handler
from .response_enhancer import response_enhancer
```

---

## File: `layers/intent_classifier.py`

```python
"""
Layer 0: Intent Classification
Routes queries to cheapest capable layer
"""
import re
from enum import Enum
from dataclasses import dataclass
from typing import Dict, List

class QueryIntent(Enum):
    FAQ = "faq"
    DATA_LOOKUP = "data_lookup"
    COMPLEX = "complex"
    GREETING = "greeting"
    OUT_OF_SCOPE = "out_of_scope"

@dataclass
class ClassifiedQuery:
    intent: QueryIntent
    confidence: float
    entities: Dict
    original_query: str

class IntentClassifier:
    
    # Data lookup indicators
    DATA_KEYWORDS = [
        "show", "list", "find", "get", "display", "retrieve",
        "how many", "count", "total", "which", "what",
        "overdue", "expiring", "expired", "due", "pending",
        "status", "check", "certificates", "properties"
    ]
    
    # FAQ indicators
    FAQ_KEYWORDS = [
        "what is", "what are", "how often", "how long",
        "when do", "when should", "who is", "who needs",
        "explain", "tell me about", "requirements", "regulations",
        "do i need", "is it required", "mandatory"
    ]
    
    # Certificate type mapping
    CERT_TYPES = {
        "gas": ["gas", "lgsr", "cp12", "gas safe", "boiler"],
        "electrical": ["eicr", "electrical", "electric", "wiring"],
        "fire": ["fra", "fire risk", "fire safety", "fire alarm"],
        "legionella": ["legionella", "lra", "water risk"],
        "asbestos": ["asbestos", "acm", "asb"],
        "epc": ["epc", "energy performance"],
    }
    
    def classify(self, query: str) -> ClassifiedQuery:
        query_lower = query.lower().strip()
        entities = self._extract_entities(query_lower)
        
        # Greetings
        if self._is_greeting(query_lower):
            return ClassifiedQuery(QueryIntent.GREETING, 0.95, entities, query)
        
        # Out of scope
        if self._is_out_of_scope(query_lower):
            return ClassifiedQuery(QueryIntent.OUT_OF_SCOPE, 0.9, entities, query)
        
        # Data lookup (check first - higher priority if entities found)
        data_score = sum(1 for kw in self.DATA_KEYWORDS if kw in query_lower)
        if data_score >= 2 or (data_score >= 1 and entities.get("date_filter")):
            return ClassifiedQuery(QueryIntent.DATA_LOOKUP, 0.85, entities, query)
        
        # FAQ
        faq_score = sum(1 for kw in self.FAQ_KEYWORDS if kw in query_lower)
        if faq_score >= 1:
            return ClassifiedQuery(QueryIntent.FAQ, 0.8, entities, query)
        
        # Default to complex
        return ClassifiedQuery(QueryIntent.COMPLEX, 0.6, entities, query)
    
    def _is_greeting(self, text: str) -> bool:
        greetings = ["hi", "hello", "hey", "good morning", "good afternoon", 
                     "thanks", "thank you", "help"]
        return any(text.startswith(g) or text == g for g in greetings)
    
    def _is_out_of_scope(self, text: str) -> bool:
        out_of_scope = ["weather", "news", "sports", "stock", "crypto",
                        "write me a poem", "translate", "play music"]
        return any(term in text for term in out_of_scope)
    
    def _extract_entities(self, query: str) -> Dict:
        entities = {"cert_types": [], "date_filter": None, "property_ref": None}
        
        # Certificate types
        for cert_type, keywords in self.CERT_TYPES.items():
            if any(kw in query for kw in keywords):
                entities["cert_types"].append(cert_type)
        
        # Date filters
        if any(term in query for term in ["overdue", "expired", "lapsed"]):
            entities["date_filter"] = "overdue"
        elif any(term in query for term in ["this week", "next 7 days"]):
            entities["date_filter"] = "this_week"
        elif any(term in query for term in ["this month", "next 30 days"]):
            entities["date_filter"] = "this_month"
        
        # UPRN extraction
        uprn_match = re.search(r'\b(1\d{11})\b', query)
        if uprn_match:
            entities["property_ref"] = {"type": "uprn", "value": uprn_match.group(1)}
        
        return entities

intent_classifier = IntentClassifier()
```

---

## File: `layers/faq_cache.py`

```python
"""
Layer 1: FAQ Cache with TF-IDF
Lightweight alternative to embeddings for Replit free tier
"""
import json
from pathlib import Path
from typing import Optional
from dataclasses import dataclass
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np

from config import config

@dataclass
class FAQMatch:
    question: str
    answer: str
    category: str
    similarity: float
    sources: list

class FAQCache:
    
    def __init__(self):
        self.faqs = []
        self.vectorizer = TfidfVectorizer(stop_words='english', ngram_range=(1, 2))
        self.tfidf_matrix = None
        self._load_faqs()
    
    def _load_faqs(self):
        faq_path = Path("data/faq_database.json")
        if not faq_path.exists():
            self.faqs = []
            return
        
        with open(faq_path) as f:
            data = json.load(f)
            self.faqs = data.get("faqs", [])
        
        if not self.faqs:
            return
        
        # Build corpus: main question + variations
        corpus = []
        self.faq_index_map = []  # Maps corpus index to FAQ index
        
        for i, faq in enumerate(self.faqs):
            # Add main question
            corpus.append(faq["question"])
            self.faq_index_map.append(i)
            
            # Add variations
            for variation in faq.get("variations", []):
                corpus.append(variation)
                self.faq_index_map.append(i)
        
        self.tfidf_matrix = self.vectorizer.fit_transform(corpus)
    
    def search(self, query: str, threshold: float = None) -> Optional[FAQMatch]:
        if not self.faqs or self.tfidf_matrix is None:
            return None
        
        threshold = threshold or config.FAQ_SIMILARITY_THRESHOLD
        
        # Transform query
        query_vec = self.vectorizer.transform([query])
        
        # Calculate similarities
        similarities = cosine_similarity(query_vec, self.tfidf_matrix)[0]
        
        # Find best match
        best_idx = np.argmax(similarities)
        best_similarity = similarities[best_idx]
        
        if best_similarity < threshold:
            return None
        
        # Map to FAQ
        faq_idx = self.faq_index_map[best_idx]
        faq = self.faqs[faq_idx]
        
        return FAQMatch(
            question=faq["question"],
            answer=faq["answer"],
            category=faq.get("category", "general"),
            similarity=float(best_similarity),
            sources=faq.get("sources", [])
        )

faq_cache = FAQCache()
```

---

## File: `layers/database_queries.py`

```python
"""
Layer 2: Database Queries
Uses Replit PostgreSQL with safe parameterized queries
"""
import asyncpg
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from dataclasses import dataclass

from config import config

@dataclass
class QueryResult:
    success: bool
    data: List[Dict]
    count: int
    query_type: str
    natural_response: str

class DatabaseQueryHandler:
    
    def __init__(self):
        self.pool = None
        self.templates = {
            "overdue_certificates": {
                "sql": """
                    SELECT c.certificate_type, c.certificate_number, 
                           c.next_due_date, p.address_line1, p.postcode
                    FROM certificates c
                    JOIN properties p ON c.property_id = p.id
                    WHERE c.next_due_date < $1 AND c.status = 'valid'
                    ORDER BY c.next_due_date LIMIT 50
                """,
                "params": lambda e: [datetime.now()]
            },
            "expiring_soon": {
                "sql": """
                    SELECT c.certificate_type, c.next_due_date,
                           p.address_line1, p.postcode,
                           (c.next_due_date - CURRENT_DATE) as days_remaining
                    FROM certificates c
                    JOIN properties p ON c.property_id = p.id
                    WHERE c.next_due_date BETWEEN $1 AND $2
                    AND c.status = 'valid'
                    ORDER BY c.next_due_date LIMIT 50
                """,
                "params": lambda e: [
                    datetime.now(),
                    datetime.now() + timedelta(days=30 if e.get("date_filter") == "this_month" else 7)
                ]
            },
            "certificates_by_type": {
                "sql": """
                    SELECT c.certificate_number, c.inspection_date, 
                           c.next_due_date, c.result, p.address_line1, p.postcode
                    FROM certificates c
                    JOIN properties p ON c.property_id = p.id
                    WHERE LOWER(c.certificate_type) = $1 AND c.status = 'valid'
                    ORDER BY c.next_due_date LIMIT 50
                """,
                "params": lambda e: [e.get("cert_types", ["lgsr"])[0]]
            },
            "property_compliance": {
                "sql": """
                    SELECT c.certificate_type, c.next_due_date, c.result,
                           CASE WHEN c.next_due_date < CURRENT_DATE THEN 'OVERDUE'
                                WHEN c.next_due_date < CURRENT_DATE + 30 THEN 'DUE_SOON'
                                ELSE 'COMPLIANT' END as status
                    FROM certificates c
                    JOIN properties p ON c.property_id = p.id
                    WHERE p.uprn = $1 AND c.status = 'valid'
                """,
                "params": lambda e: [e.get("property_ref", {}).get("value", "")]
            },
            "compliance_summary": {
                "sql": """
                    SELECT certificate_type,
                           COUNT(*) as total,
                           SUM(CASE WHEN next_due_date < CURRENT_DATE THEN 1 ELSE 0 END) as overdue,
                           SUM(CASE WHEN next_due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 THEN 1 ELSE 0 END) as due_soon
                    FROM certificates WHERE status = 'valid'
                    GROUP BY certificate_type ORDER BY overdue DESC
                """,
                "params": lambda e: []
            }
        }
    
    async def connect(self):
        if not self.pool and config.DATABASE_URL:
            try:
                self.pool = await asyncpg.create_pool(config.DATABASE_URL, min_size=1, max_size=5)
            except Exception as e:
                print(f"Database connection failed: {e}")
    
    async def execute(self, query_name: str, entities: Dict) -> QueryResult:
        if query_name not in self.templates:
            return QueryResult(False, [], 0, query_name, "Unknown query type")
        
        if not config.DATABASE_URL:
            return QueryResult(False, [], 0, query_name, 
                "Database not configured. Add DATABASE_URL to Replit Secrets.")
        
        await self.connect()
        if not self.pool:
            return QueryResult(False, [], 0, query_name, "Database connection failed")
        
        template = self.templates[query_name]
        params = template["params"](entities)
        
        try:
            async with self.pool.acquire() as conn:
                rows = await conn.fetch(template["sql"], *params)
                data = [dict(row) for row in rows]
                
                return QueryResult(
                    success=True,
                    data=data,
                    count=len(data),
                    query_type=query_name,
                    natural_response=self._format_response(query_name, data)
                )
        except Exception as e:
            return QueryResult(False, [], 0, query_name, f"Query error: {str(e)}")
    
    def _format_response(self, query_name: str, data: List[Dict]) -> str:
        count = len(data)
        
        if count == 0:
            if query_name == "overdue_certificates":
                return "✅ No overdue certificates found."
            return "No results found."
        
        if query_name == "overdue_certificates":
            lines = [f"⚠️ **{count} overdue certificates:**\n"]
            lines.append("| Type | Property | Due Date |")
            lines.append("|------|----------|----------|")
            for row in data[:10]:
                due = row.get('next_due_date')
                due_str = due.strftime('%d/%m/%Y') if due else 'N/A'
                lines.append(f"| {row.get('certificate_type')} | {row.get('postcode')} | {due_str} |")
            if count > 10:
                lines.append(f"\n*...and {count - 10} more*")
            return "\n".join(lines)
        
        if query_name == "compliance_summary":
            lines = ["## Compliance Summary\n"]
            lines.append("| Type | Total | Overdue | Due Soon |")
            lines.append("|------|-------|---------|----------|")
            for row in data:
                lines.append(f"| {row.get('certificate_type')} | {row.get('total')} | "
                           f"**{row.get('overdue', 0)}** | {row.get('due_soon', 0)} |")
            return "\n".join(lines)
        
        return f"Found {count} results."
    
    def route_query(self, entities: Dict) -> str:
        """Determine which query to run based on entities"""
        if entities.get("property_ref"):
            return "property_compliance"
        if entities.get("date_filter") == "overdue":
            return "overdue_certificates"
        if entities.get("date_filter") in ["this_week", "this_month"]:
            return "expiring_soon"
        if entities.get("cert_types"):
            return "certificates_by_type"
        return "compliance_summary"

db_handler = DatabaseQueryHandler()
```

---

## File: `layers/llm_handler.py`

```python
"""
Layer 3: Claude LLM with basic RAG
Only called when Layers 1-2 can't answer
"""
import anthropic
from typing import Dict, List
from dataclasses import dataclass

from config import config

@dataclass
class LLMResponse:
    content: str
    tokens_used: int
    sources: List[str]

class LLMHandler:
    
    SYSTEM_PROMPT = """You are ComplianceAI, an expert on UK social housing compliance.

You help with:
- Gas safety (LGSR, CP12, Gas Safe Regulations 1998)
- Electrical safety (EICR, BS 7671)
- Fire safety (FRA, Fire Safety Order 2005)
- Legionella (HSG274, ACOP L8)
- Asbestos (HSG264)

Guidelines:
1. Cite specific regulations when giving advice
2. Use UK date formats (DD/MM/YYYY)
3. Be concise but accurate
4. Recommend professional consultation for complex legal matters
5. Never provide legal advice - only regulatory guidance"""

    def __init__(self):
        self.client = None
        if config.ANTHROPIC_API_KEY:
            self.client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)
    
    async def generate(self, query: str, entities: Dict) -> LLMResponse:
        if not self.client:
            return LLMResponse(
                content="LLM not configured. Add ANTHROPIC_API_KEY to Replit Secrets.",
                tokens_used=0,
                sources=[]
            )
        
        # Add context based on entities
        context = self._build_context(entities)
        
        user_message = query
        if context:
            user_message = f"{context}\n\nQuestion: {query}"
        
        try:
            response = self.client.messages.create(
                model=config.LLM_MODEL,
                max_tokens=config.LLM_MAX_TOKENS,
                system=self.SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_message}]
            )
            
            content = response.content[0].text
            
            # Add disclaimer for sensitive topics
            if any(word in content.lower() for word in ["legal", "prosecution", "court", "penalty"]):
                content += "\n\n---\n*⚠️ This is general guidance only. Consult a qualified professional for specific advice.*"
            
            return LLMResponse(
                content=content,
                tokens_used=response.usage.input_tokens + response.usage.output_tokens,
                sources=self._extract_sources(content)
            )
            
        except anthropic.RateLimitError:
            return LLMResponse("Rate limit reached. Please try again shortly.", 0, [])
        except Exception as e:
            return LLMResponse(f"Error: {str(e)}", 0, [])
    
    def _build_context(self, entities: Dict) -> str:
        """Add relevant context based on detected entities"""
        cert_types = entities.get("cert_types", [])
        
        context_map = {
            "gas": "Context: Gas Safety (Installation and Use) Regulations 1998 require annual inspections.",
            "electrical": "Context: Electrical Safety Standards Regulations 2020 require EICR every 5 years.",
            "fire": "Context: Regulatory Reform (Fire Safety) Order 2005 applies to common areas.",
            "legionella": "Context: HSG274 and ACOP L8 cover Legionella risk assessment requirements.",
            "asbestos": "Context: Control of Asbestos Regulations 2012 - duty to manage ACMs.",
        }
        
        contexts = [context_map[ct] for ct in cert_types if ct in context_map]
        return " ".join(contexts)
    
    def _extract_sources(self, text: str) -> List[str]:
        """Extract regulation references from response"""
        import re
        patterns = [
            r"(?:Gas Safety|Electrical Safety|Fire Safety).+?Regulations?\s*\d{4}",
            r"BS \d{4}(?::\d+)?",
            r"HSG\s?\d+",
            r"ACOP L\d+",
            r"PAS \d+-\d+:\d+",
        ]
        
        sources = []
        for pattern in patterns:
            sources.extend(re.findall(pattern, text, re.IGNORECASE))
        return list(set(sources))

llm_handler = LLMHandler()
```

---

## File: `layers/response_enhancer.py`

```python
"""
Layer 4: Response Enhancement
Adds disclaimers and logging
"""
from datetime import datetime
from dataclasses import dataclass
import json

@dataclass
class EnhancedResponse:
    content: str
    layer_used: str
    response_time_ms: int
    confidence: float

class ResponseEnhancer:
    
    DISCLAIMER = "\n\n---\n*This is guidance only. Consult qualified professionals for specific compliance requirements.*"
    
    def enhance(
        self,
        content: str,
        layer_used: str,
        response_time_ms: int,
        confidence: float,
        add_disclaimer: bool = False
    ) -> EnhancedResponse:
        
        # Add disclaimer for LLM responses or low confidence
        if add_disclaimer or (layer_used == "llm" and confidence < 0.8):
            if self.DISCLAIMER not in content:
                content += self.DISCLAIMER
        
        # Log interaction (prints to Replit console)
        self._log(layer_used, response_time_ms, confidence)
        
        return EnhancedResponse(
            content=content,
            layer_used=layer_used,
            response_time_ms=response_time_ms,
            confidence=confidence
        )
    
    def _log(self, layer: str, time_ms: int, confidence: float):
        log = {
            "timestamp": datetime.utcnow().isoformat(),
            "layer": layer,
            "response_time_ms": time_ms,
            "confidence": round(confidence, 2)
        }
        print(f"[LOG] {json.dumps(log)}")

response_enhancer = ResponseEnhancer()
```

---

## File: `main.py`

```python
"""
ComplianceAI Chatbot - Replit Implementation
5-Layer Cost-Optimized Architecture
"""
import time
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import uvicorn

from layers import (
    intent_classifier, QueryIntent,
    faq_cache, db_handler, llm_handler, response_enhancer
)

app = FastAPI(title="ComplianceAI", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str
    user_id: Optional[str] = None

class ChatResponse(BaseModel):
    response: str
    layer_used: str
    response_time_ms: int
    confidence: float

# Static responses
GREETING = """Hello! I'm ComplianceAI, your housing compliance assistant.

I can help with:
📋 **Regulations** - Gas, electrical, fire safety requirements
🔍 **Data lookups** - Find overdue certificates, property status
📊 **Summaries** - Compliance statistics

What would you like to know?"""

OUT_OF_SCOPE = """I specialise in UK housing compliance - gas safety, electrical, fire risk, etc.

Try asking:
- "How often do gas certificates need renewing?"
- "Show me overdue electrical certificates"
- "What are the EICR requirements?"

Is there a compliance topic I can help with?"""


@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    start = time.time()
    query = request.message.strip()
    
    if not query:
        raise HTTPException(400, "Message required")
    
    # Layer 0: Intent Classification
    classified = intent_classifier.classify(query)
    
    # Route based on intent
    if classified.intent == QueryIntent.GREETING:
        content, layer, confidence = GREETING, "greeting", 1.0
        
    elif classified.intent == QueryIntent.OUT_OF_SCOPE:
        content, layer, confidence = OUT_OF_SCOPE, "out_of_scope", 0.9
        
    elif classified.intent == QueryIntent.FAQ:
        # Layer 1: FAQ Cache
        match = faq_cache.search(query)
        
        if match:
            content, layer, confidence = match.answer, "faq_cache", match.similarity
        else:
            # Fallback to LLM
            llm_result = await llm_handler.generate(query, classified.entities)
            content, layer, confidence = llm_result.content, "llm", 0.7
            
    elif classified.intent == QueryIntent.DATA_LOOKUP:
        # Layer 2: Database
        query_name = db_handler.route_query(classified.entities)
        result = await db_handler.execute(query_name, classified.entities)
        
        if result.success and result.data:
            content, layer, confidence = result.natural_response, "database", 0.95
        else:
            # Fallback to LLM
            llm_result = await llm_handler.generate(query, classified.entities)
            content, layer, confidence = llm_result.content, "llm", 0.7
            
    else:
        # Layer 3: LLM for complex queries
        llm_result = await llm_handler.generate(query, classified.entities)
        content, layer, confidence = llm_result.content, "llm", 0.8
    
    # Layer 4: Enhancement
    response_time = int((time.time() - start) * 1000)
    enhanced = response_enhancer.enhance(content, layer, response_time, confidence)
    
    return ChatResponse(
        response=enhanced.content,
        layer_used=enhanced.layer_used,
        response_time_ms=enhanced.response_time_ms,
        confidence=enhanced.confidence
    )


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/stats")
async def stats():
    return {
        "faq_count": len(faq_cache.faqs),
        "db_connected": db_handler.pool is not None,
        "llm_configured": llm_handler.client is not None
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

---

## File: `data/faq_database.json`

Use the FAQ database I created earlier (45 FAQs covering gas, electrical, fire, legionella, asbestos, and general compliance topics).

---

## Database Setup (Replit PostgreSQL)

Run this SQL in Replit's PostgreSQL shell:

```sql
CREATE TABLE properties (
    id SERIAL PRIMARY KEY,
    uprn VARCHAR(12) UNIQUE NOT NULL,
    address_line1 VARCHAR(255),
    city VARCHAR(100),
    postcode VARCHAR(10)
);

CREATE TABLE certificates (
    id SERIAL PRIMARY KEY,
    property_id INTEGER REFERENCES properties(id),
    certificate_type VARCHAR(20) NOT NULL,
    certificate_number VARCHAR(50),
    inspection_date DATE,
    next_due_date DATE,
    result VARCHAR(50),
    status VARCHAR(20) DEFAULT 'valid'
);

CREATE INDEX idx_cert_due ON certificates(next_due_date);
CREATE INDEX idx_cert_type ON certificates(certificate_type);

-- Sample data
INSERT INTO properties (uprn, address_line1, city, postcode) VALUES
('100012345678', '15 High Street', 'Southampton', 'SO14 2DH'),
('100012345679', 'Flat 3, Oak House', 'Southampton', 'SO17 1BJ');

INSERT INTO certificates (property_id, certificate_type, certificate_number, inspection_date, next_due_date, result) VALUES
(1, 'LGSR', 'GSR-2024-001', '2024-01-15', '2024-06-15', 'SATISFACTORY'),
(1, 'EICR', 'EICR-2024-001', '2024-02-20', '2029-02-20', 'SATISFACTORY'),
(2, 'LGSR', 'GSR-2024-002', '2023-12-01', '2024-12-01', 'SATISFACTORY');
```

---

## Replit Secrets Required

Add these in the **Secrets** tab (🔒 icon):

| Key | Value |
|-----|-------|
| `ANTHROPIC_API_KEY` | Your Anthropic API key |
| `DATABASE_URL` | Auto-populated if using Replit PostgreSQL |

---

## Testing the Chatbot

```bash
# Health check
curl http://localhost:8000/health

# FAQ query (Layer 1)
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "How often do gas certificates need renewing?"}'

# Data query (Layer 2)
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Show me overdue certificates"}'

# Complex query (Layer 3)
curl -X POST http://localhost:8000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "What happens if a tenant refuses access for gas inspection and I cannot complete the annual check?"}'
```

---

## Cost Analysis

| Layer | % Traffic | Cost |
|-------|-----------|------|
| FAQ Cache | ~45% | FREE |
| Database | ~35% | FREE |
| Claude LLM | ~20% | ~$0.002/query |

**Monthly estimate (10K queries):** ~$4 vs $20+ for always-LLM
