import { Entity, PrimaryGeneratedColumn, Column, Index } from 'typeorm';

@Entity('pokemon')
export class Pokemon {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  name: string;

  @Column()
  type: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({
    type: 'timestamp',
    default: () => 'CURRENT_TIMESTAMP',
    onUpdate: 'CURRENT_TIMESTAMP'
  })
  updatedAt: Date;
}
