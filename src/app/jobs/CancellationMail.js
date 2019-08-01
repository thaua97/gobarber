import { format, parseISO } from 'date-fns';
import pt from 'date-fns/locale/pt';
import Mail from '../../lib/Mail';

class CancellationMail {
    get Key() {
        return 'CancellationMail';
    }

    async handle({ data }) {
        const { appoitment } = data;

        Mail.sendMail({
            to: `${appoitment.provider.name} <${appoitment.provider.email}>`,
            subject: 'Agendamento cancelado',
            template: 'cancellation',
            context: {
                provider: appoitment.provider.name,
                user: appoitment.user.name,
                data: format(
                    parseISO(appoitment.data),
                    "'dia' dd 'de' MMMM', às' H'h'mm",
                    {
                        locale: pt,
                    }
                ),
            },
        });
    }
}

export default new CancellationMail();
