import { Entity, PrimaryColumn, Column } from "typeorm";

@Entity({ name: "seller" })
export class Seller {
  @PrimaryColumn({ name: "seller_id", type: "int" })
  seller_id!: number;

  @Column({ name: "created_at", type: "timestamp", nullable: true, default: () => "CURRENT_TIMESTAMP" })
  created_at?: Date;
}