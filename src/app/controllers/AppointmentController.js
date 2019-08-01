import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt';

import Appointment from '../models/Appointment';
import File from '../models/File';
import User from '../models/User';
import Notification from '../schemas/Notification';

import Queue from '../../lib/Queue';

import CancellationMail from '../jobs/CancellationMail';

class AppointmentController {
    async index(req, res) {
        const { page = 1 } = req.query;

        const appointment = await Appointment.findAll({
            where: {
                user_id: req.userId,
                canceled_at: null,
            },
            order: ['data'],
            attributes: ['id', 'data'],
            limit: 20,
            offset: (page - 1) * 20,
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['id', 'name'],
                    include: [
                        {
                            model: File,
                            as: 'avatar',
                            attributes: ['id', 'path', 'url'],
                        },
                    ],
                },
            ],
        });

        return res.json(appointment);
    }

    async store(req, res) {
        const schema = Yup.object().shape({
            provider_id: Yup.number().required(),
            data: Yup.date().required(),
        });

        if (!(await schema.isValid(req.body))) {
            return res.status(400).json({
                error: 'Validação falhou!',
            });
        }

        const { provider_id, data } = req.body;

        /**
         * Check if provider_id is a provider
         */
        const checkIsProvider = await User.findOne({
            where: {
                id: provider_id,
                provider: true,
            },
        });

        if (!checkIsProvider) {
            return res.status(401).json({
                error: 'O Usuario não é um provedor!',
            });
        }

        /**
         * Check if provider agend in your provider profile.
         */
        if (provider_id === req.userId) {
            return res.status(401).json({
                error: 'Você não poder marcar um horario para você mesmo',
            });
        }

        /**
         * Check for past dates
         */
        const hourStart = startOfHour(parseISO(data));

        if (isBefore(hourStart, new Date())) {
            return res.status(400).json({
                error: 'Este horario não esta mais disponivel, pois já passou!',
            });
        }

        /**
         * Check date availability
         */
        const checkAvailibility = await Appointment.findOne({
            where: {
                provider_id,
                canceled_at: null,
                data: hourStart,
            },
        });

        if (checkAvailibility) {
            return res.status(400).json({
                error: 'Horario não esta disponivel!',
            });
        }

        /**
         * If is all ok
         */
        const appointment = await Appointment.create({
            user_id: req.userId,
            provider_id,
            data,
        });

        /**
         * Notify appointment provider
         */
        const user = await User.findByPk(req.userId);
        const formattedDate = format(
            hourStart,
            "'dia' dd 'de' MMMM', às' H'h'mm",
            {
                locale: pt,
            }
        );

        await Notification.create({
            content: `Novo agendamento de ${user.name} para ${formattedDate}`,
            user: provider_id,
        });

        return res.json(appointment);
    }

    async delete(req, res) {
        const appointment = await Appointment.findByPk(req.params.id, {
            include: [
                {
                    model: User,
                    as: 'provider',
                    attributes: ['name', 'email'],
                },
                {
                    model: User,
                    as: 'user',
                    attributes: ['name'],
                },
            ],
        });

        if (appointment.canceled_at !== null) {
            return res.status(400).json({
                error: 'Este agendamento já foi Cancelado.',
            });
        }

        if (appointment.user_id !== req.userId) {
            return res.status(400).json({
                error: 'Este agendamento não pertence a você!',
            });
        }

        const dateWithSub = subHours(appointment.data, 2);

        if (isBefore(dateWithSub, new Date())) {
            return res.status(401).json({
                error:
                    'Você só pode cancelar até 2 horas antes do atendimento.',
            });
        }

        appointment.canceled_at = new Date();

        await appointment.save();

        await Queue.add(CancellationMail.key, {
            appointment,
        });

        return res.json(appointment);
    }
}

export default new AppointmentController();
