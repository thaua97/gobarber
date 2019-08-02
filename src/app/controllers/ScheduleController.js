import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { Op } from 'sequelize';

import Appointment from '../models/Appointment';
import User from '../models/User';

class ScheduleController {
    async index(req, res) {
        const checkUserProvider = await User.findOne({
            where: {
                id: req.userId,
                provider: true,
            },
        });

        if (!checkUserProvider) {
            return res
                .status(401)
                .json({ error: 'Você não é um provedor de serviços!' });
        }

        const { data } = req.query;
        const parseDate = parseISO(data);

        const appointments = await Appointment.findAll({
            where: {
                provider_id: req.userId,
                canceled_at: null,
                data: {
                    [Op.between]: [startOfDay(parseDate), endOfDay(parseDate)],
                },
            },
            include: [
                {
                    model: User,
                    as: 'user',
                    attributes: ['name'],
                },
            ],
            order: ['data'],
        });

        return res.json(appointments);
    }
}

export default new ScheduleController();
