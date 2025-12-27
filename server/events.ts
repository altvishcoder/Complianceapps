import type { Response } from "express";

type SSEClient = { id: string; res: Response };
const sseClients: SSEClient[] = [];

export function addSSEClient(id: string, res: Response) {
  sseClients.push({ id, res });
}

export function removeSSEClient(id: string) {
  const index = sseClients.findIndex(c => c.id === id);
  if (index !== -1) {
    sseClients.splice(index, 1);
  }
}

export function broadcastExtractionEvent(event: { 
  type: 'extraction_complete' | 'property_updated' | 'certificate_updated';
  certificateId?: string;
  propertyId?: string;
  status?: string;
}) {
  const data = JSON.stringify(event);
  sseClients.forEach(client => {
    try {
      client.res.write(`data: ${data}\n\n`);
    } catch (e) {
      // Client disconnected, will be cleaned up
    }
  });
}
