import { Request } from 'express';
import sgMail from '@sendgrid/mail';
import fs from 'fs/promises';
import Handlebars from 'handlebars';
import path from 'path';

import { env } from '@/configs/env.config';
import { ERROR_CODES } from '@/constants/error-codes.constant';
import { STATUS_CODES } from '@/constants/statuscodes.constant';
import { ApiError } from '@/errors/ApiError.error';
import logger from '@/loggers/winston.logger';

sgMail.setApiKey(env.sendgrid.SEND_GRID_API_KEY);
interface SendLocalEmailOptions {
    to: string;
    subject: string;
    templatePath: string;
    dynamicData: Record<string, any>;
}

/**
 * Compile email template with dynamic data
 */
const compileTemplateHelper = async (templatePath: string, dynamicData: Record<string, unknown>) => {
    const templateFile = path.join(process.cwd(), 'templates', templatePath);
    const templateContent = await fs.readFile(templateFile, 'utf-8');
    const compiledTemplate = Handlebars.compile(templateContent);
    return compiledTemplate(dynamicData);
};

export const sendEmail = async (req: Request, options: SendLocalEmailOptions) => {
    const t = req.t;

    try {
        const htmlContent = await compileTemplateHelper(options.templatePath, options.dynamicData);

        return await sgMail.send({
            to: options.to,
            from: env.sendgrid.SEND_GRID_FROM_EMAIL,
            subject: options.subject,
            html: htmlContent,
        });
    } catch (error) {
        logger.error(error);
        throw new ApiError(
            STATUS_CODES.GENERAL_ERROR,
            ERROR_CODES.GENERAL_ERROR,
            t('email_not_sent_message', { ns: 'error' }),
            t('email_not_sent_details', { ns: 'error' }),
            t('email_not_sent_suggestion', { ns: 'error' }),
        );
    }
};
