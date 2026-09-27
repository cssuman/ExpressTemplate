import { Request } from 'express';
import sgMail, { ClientResponse } from '@sendgrid/mail';
import fs from 'fs/promises';
import Handlebars from 'handlebars';
import path from 'path';

import { env } from '@/config/env';
import { ERROR_CODES } from '@/constant/error.codes';
import { STATUS_CODES } from '@/constant/status.codes';
import { ApiError } from '@/error/ApiError';
import logger from '@/logger/winston.logger';

/**
 * Templates live outside `src/` on purpose: `tsc` only emits .js files, so
 * anything kept next to the TypeScript source silently disappears from the
 * production build. Resolving from the working directory keeps development and
 * `npm start` identical - the same reason `locales/` sits at the repo root.
 *
 * @see docs/13-email.md
 */
const TEMPLATE_DIR = path.resolve(process.cwd(), 'templates/email');

/**
 * Compiling Handlebars is CPU work; doing it per email wastes it. Templates are
 * compiled once and reused, except in development where you want edits to show
 * up without a restart.
 */
const templateCache = new Map<string, HandlebarsTemplateDelegate>();

export interface SendEmailOptions {
    to: string;
    subject: string;
    /** Path relative to `templates/email`, e.g. `public/welcome.template.html`. */
    templatePath: string;
    dynamicData: Record<string, unknown>;
}

if (env.sendgrid.isConfigured) sgMail.setApiKey(env.sendgrid.SEND_GRID_API_KEY as string);

const loadTemplate = async (templatePath: string): Promise<HandlebarsTemplateDelegate> => {
    const cached = templateCache.get(templatePath);
    if (cached && env.app.NODE_ENV !== 'development') return cached;

    const resolved = path.resolve(TEMPLATE_DIR, templatePath);

    /**
     * Path traversal guard. If `templatePath` ever becomes user-influenced,
     * `../../.env` would otherwise be a readable template - and its contents
     * would be mailed to whoever asked.
     */
    if (!resolved.startsWith(TEMPLATE_DIR + path.sep)) {
        throw new Error(`Refusing to load template outside ${TEMPLATE_DIR}: ${templatePath}`);
    }

    const compiled = Handlebars.compile(await fs.readFile(resolved, 'utf-8'));
    templateCache.set(templatePath, compiled);

    return compiled;
};

/**
 * Renders a local Handlebars template and sends it through SendGrid.
 *
 * Keeping the template in the repository (instead of SendGrid's dashboard)
 * means email content is code-reviewed, versioned and works offline.
 */
export const sendEmail = async (req: Request, options: SendEmailOptions): Promise<[ClientResponse, object]> => {
    const t = req.t;

    /**
     * Optional integrations fail at CALL time with an actionable message rather
     * than at boot: a fork that never sends email should not be forced to
     * invent SendGrid credentials to start the server.
     */
    if (!env.sendgrid.isConfigured) {
        throw new ApiError(
            STATUS_CODES.SERVICE_UNAVAILABLE,
            ERROR_CODES.SERVICE_UNAVAILABLE,
            t('email_not_configured_message', { ns: 'error' }),
            t('email_not_configured_details', { ns: 'error' }),
            t('email_not_configured_suggestion', { ns: 'error' }),
        );
    }

    try {
        const template = await loadTemplate(options.templatePath);

        return await sgMail.send({
            to: options.to,
            from: env.sendgrid.SEND_GRID_FROM_EMAIL as string,
            subject: options.subject,
            html: template(options.dynamicData),
        });
    } catch (error) {
        // The provider's error may contain the API key or recipient data, so it
        // is logged server-side and never forwarded to the client.
        logger.error('Failed to send email', { error });

        throw new ApiError(
            STATUS_CODES.GENERAL_ERROR,
            ERROR_CODES.GENERAL_ERROR,
            t('email_not_sent_message', { ns: 'error' }),
            t('email_not_sent_details', { ns: 'error' }),
            t('email_not_sent_suggestion', { ns: 'error' }),
        );
    }
};
