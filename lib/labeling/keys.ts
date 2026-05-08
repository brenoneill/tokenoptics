export function analysisKey(projectId: string, sessionId: string): string {
  return `${projectId}:${sessionId}`;
}
