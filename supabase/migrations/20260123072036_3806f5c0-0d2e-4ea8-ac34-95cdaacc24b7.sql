-- Migration 1: Add supervisor role to enum only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'supervisor';