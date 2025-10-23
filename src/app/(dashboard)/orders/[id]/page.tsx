import { getCurrentUser } from '@/auth/get-user';
import { redirect } from 'next/navigation';
import { OrderDetails } from '@/components/orders/order-details';

interface OrderPageProps {
  params: {
    id: string;
  };
}

export default async function OrderPage({ params }: OrderPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/auth/signin');
  }

  return (
    <div>
      <OrderDetails orderId={params.id} userRole={user.role || ''} />
    </div>
  );
}
