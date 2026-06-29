/**
 * YUAN SHOWROOM — Audit Logging
 *
 * Records document access events for security and analytics.
 */

import { prisma } from '@/lib/prisma'

type AuditAction = 'view' | 'edit' | 'delete' | 'analyze' | 'upload'

export async function logDocumentAccess(
  userId: string,
  documentId: string,
  action: AuditAction,
  metadata?: Record<string, string>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        documentId,
        action,
      },
    })
  } catch {
    // Audit logging must never block the main operation
    console.error(`[AUDIT] Failed to log ${action} for user ${userId} on doc ${documentId}`)
  }
}

/** Log a document view (called from reading page) */
export function logView(userId: string, documentId: string) {
  return logDocumentAccess(userId, documentId, 'view')
}

/** Log a document edit */
export function logEdit(userId: string, documentId: string) {
  return logDocumentAccess(userId, documentId, 'edit')
}

/** Log a document deletion */
export function logDelete(userId: string, documentId: string) {
  return logDocumentAccess(userId, documentId, 'delete')
}
