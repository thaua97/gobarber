import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore } from 'date-fns';
import Appointment from '../models/Appointment';
import User from '../models/User';

class AppointmentController {
    async store(req, res) {
        const schema = Yup.object().shape({
            provider_id: Yup.number().required(),
            data: Yup.date().required(),
        });

        if (!(await schema.isValid(req.body))) {
            return res.status(400).json({ error: 'Validação falhou!' });
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
            return res
                .status(401)
                .json({ error: 'O Usuario não é um provedor!' });
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
            return res
                .status(400)
                .json({ error: 'Horario não esta disponivel!' });
        }

        /**
         * If is all ok
         */
        const appointment = await Appointment.create({
            user_id: req.userId,
            provider_id,
            data,
        });

        return res.json(appointment);
    }
}

export default new AppointmentController();
