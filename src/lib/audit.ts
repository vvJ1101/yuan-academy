/**
 * YUAN SHOWROOM — Audit Logging
 *
 * Records document access events for security and analytics.
 */

import { prisma } from '@/lib/prisma'

type AuditAction = 'view' | 'edit' | 'delete' | 'analyze' | 'upload' | 'preview' | 'download' | 'print'

export async function logDocumentAccess(
  userId: string,
  documentId: string,
  action: AuditAction,
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

/** Log a document upload. */
export function logUpload(userId: string, documentId: string) {
  return logDocumentAccess(userId, documentId, 'upload')
}

/** Log a document deletion */
export function logDelete(userId: string, documentId: string) {
  return logDocumentAccess(userId, documentId, 'delete')
}

/** Log a policy update or spreadsheet upload. */
export async function logPolicyChange(
  userId: string,
  action: 'policy:update' | 'policy:upload',
) {
  try {
    await prisma.auditLog.create({ data: { userId, action } })
  } catch {
    // Audit logging must never block the main operation
    console.error(`[AUDIT] Failed to log ${action} for user ${userId}`)
  }
}
