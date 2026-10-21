import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { OrderDetails } from "@/features/order/order-details";
import { getOrder } from "@/lib/backend/client";
import type { Order } from "@/lib/backend/schemas";

type Props = PageProps<"/order/[orderNumber]">;

const findOrder = cache(getOrder);

async function orderFor({ params }: Props): Promise<Order> {
  const { orderNumber } = await params;
  const order = await findOrder(orderNumber);
  if (order === null) notFound();
  return order;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const order = await orderFor(props);
  return {
    title: `Order ${order.orderNumber} | Wick & Co. Candles`,
    description:
      "Hand poured candles in floral, woody, fresh, gourmand and spicy scents.",
  };
}

export default async function OrderPage(props: Props) {
  return <OrderDetails order={await orderFor(props)} />;
}
