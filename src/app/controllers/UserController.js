import User from '../models/User';

class UserController {
    async store(req, res) {
        const userExsists = await User.findOne({
            where: { email: req.body.email },
        });

        if (userExsists) {
            return res.status(400).json({
                error: 'Usuario já existe',
            });
        }

        const { id, name, email, provider } = await User.create(req.body);

        return res.json({
            id,
            name,
            email,
            provider,
        });
    }
}

export default new UserController();
