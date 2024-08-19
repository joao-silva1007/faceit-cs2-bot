import mongoose, { type Document, Schema } from 'mongoose';
import { connection } from '../utils/db';

export interface IUser extends Document {
    _id: string;
    name: string;
    acredita: string;
}

const UserSchema: Schema = new Schema({
    name: { type: String, required: true },
    acredita: { type: String, required: true },
});

const User = connection.model<IUser>('User', UserSchema);

export default User;