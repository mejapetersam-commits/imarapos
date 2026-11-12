export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          business_id: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          business_id: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          business_id?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      business_members: {
        Row: {
          business_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          business_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          business_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_members_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      businesses: {
        Row: {
          created_at: string
          currency: string
          id: string
          name: string
          owner_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          name: string
          owner_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          name?: string
          owner_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          business_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_addresses: {
        Row: {
          address: string
          business_id: string
          created_at: string
          customer_id: string
          id: string
          is_default: boolean
          label: string | null
        }
        Insert: {
          address: string
          business_id: string
          created_at?: string
          customer_id: string
          id?: string
          is_default?: boolean
          label?: string | null
        }
        Update: {
          address?: string
          business_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          is_default?: boolean
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_addresses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_addresses_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          business_id: string
          created_at: string
          credit_limit: number
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          created_at?: string
          credit_limit?: number
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          created_at?: string
          credit_limit?: number
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          business_id: string
          category: string
          created_at: string
          description: string
          id: string
          incurred_at: string
        }
        Insert: {
          amount: number
          business_id: string
          category: string
          created_at?: string
          description: string
          id?: string
          incurred_at?: string
        }
        Update: {
          amount?: number
          business_id?: string
          category?: string
          created_at?: string
          description?: string
          id?: string
          incurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          business_id: string
          id: string
          product_id: string
          quantity_on_hand: number
          updated_at: string
        }
        Insert: {
          business_id: string
          id?: string
          product_id: string
          quantity_on_hand?: number
          updated_at?: string
        }
        Update: {
          business_id?: string
          id?: string
          product_id?: string
          quantity_on_hand?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          business_id: string
          confirmed_at: string | null
          created_at: string
          customer_id: string | null
          id: string
          method: string
          reference: string | null
          sale_id: string | null
          status: string
        }
        Insert: {
          amount: number
          business_id: string
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          method: string
          reference?: string | null
          sale_id?: string | null
          status?: string
        }
        Update: {
          amount?: number
          business_id?: string
          confirmed_at?: string | null
          created_at?: string
          customer_id?: string | null
          id?: string
          method?: string
          reference?: string | null
          sale_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          barcode: string | null
          business_id: string
          category_id: string | null
          cost_price: number
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          low_stock_threshold: number
          name: string
          selling_price: number
          sku: string
          supplier_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          barcode?: string | null
          business_id: string
          category_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          name: string
          selling_price?: number
          sku: string
          supplier_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          barcode?: string | null
          business_id?: string
          category_id?: string | null
          cost_price?: number
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          low_stock_threshold?: number
          name?: string
          selling_price?: number
          sku?: string
          supplier_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      purchase_order_items: {
        Row: {
          business_id: string
          created_at: string
          id: string
          product_id: string
          purchase_order_id: string
          quantity: number
          unit_cost: number
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          product_id: string
          purchase_order_id: string
          quantity: number
          unit_cost: number
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          product_id?: string
          purchase_order_id?: string
          quantity?: number
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey"
            columns: ["purchase_order_id"]
            isOneToOne: false
            referencedRelation: "purchase_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      purchase_orders: {
        Row: {
          business_id: string
          created_at: string
          expected_at: string | null
          id: string
          notes: string | null
          order_number: string
          status: string
          supplier_id: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          expected_at?: string | null
          id?: string
          notes?: string | null
          order_number: string
          status?: string
          supplier_id?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          expected_at?: string | null
          id?: string
          notes?: string | null
          order_number?: string
          status?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          business_id: string
          created_at: string
          discount: number
          id: string
          product_id: string | null
          product_name: string
          quantity: number
          sale_id: string
          unit_cost: number
          unit_price: number
        }
        Insert: {
          business_id: string
          created_at?: string
          discount?: number
          id?: string
          product_id?: string | null
          product_name: string
          quantity: number
          sale_id: string
          unit_cost?: number
          unit_price: number
        }
        Update: {
          business_id?: string
          created_at?: string
          discount?: number
          id?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          sale_id?: string
          unit_cost?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          business_id: string
          created_at: string
          customer_id: string | null
          discount: number
          id: string
          sale_number: string
          salesperson_id: string | null
          status: string
          subtotal: number
          total: number
        }
        Insert: {
          business_id: string
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          sale_number: string
          salesperson_id?: string | null
          status?: string
          subtotal?: number
          total?: number
        }
        Update: {
          business_id?: string
          created_at?: string
          customer_id?: string | null
          discount?: number
          id?: string
          sale_number?: string
          salesperson_id?: string | null
          status?: string
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "sales_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          business_id: string
          created_at: string
          created_by: string | null
          id: string
          product_id: string
          quantity_delta: number
          reason: string
          reference: string | null
        }
        Insert: {
          business_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id: string
          quantity_delta: number
          reason: string
          reference?: string | null
        }
        Update: {
          business_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string
          reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          business_id: string
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          business_id: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          business_id?: string
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          business_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Insert: {
          business_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["business_role"]
          user_id: string
        }
        Update: {
          business_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["business_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_business_id_fkey"
            columns: ["business_id"]
            isOneToOne: false
            referencedRelation: "businesses"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_business_role: {
        Args: {
          _business_id: string
          _role: Database["public"]["Enums"]["business_role"]
        }
        Returns: boolean
      }
      is_business_member: { Args: { _business_id: string }; Returns: boolean }
    }
    Enums: {
      business_role: "owner" | "manager" | "cashier" | "inventory"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      business_role: ["owner", "manager", "cashier", "inventory"],
    },
  },
} as const
