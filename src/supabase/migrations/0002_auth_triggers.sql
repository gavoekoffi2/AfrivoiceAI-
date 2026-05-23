-- ============================================================================
-- AfrivoiceAI – Triggers Supabase Auth
-- Crée automatiquement organization + user row + wallet à l'inscription.
-- Cette migration doit être appliquée sur la base Supabase (PAS sur Postgres
-- standalone qui n'a pas de schema "auth").
-- ============================================================================

-- ne s'exécute que si le schéma "auth" existe (= Supabase)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'auth') THEN
    RAISE NOTICE 'Schéma auth absent : migration 0002 ignorée (Postgres standalone).';
    RETURN;
  END IF;

  -- Helper : slugifier un nom
  CREATE OR REPLACE FUNCTION public.afv_slugify(input TEXT)
  RETURNS TEXT AS $f$
  DECLARE
    s TEXT;
  BEGIN
    s := lower(coalesce(input, ''));
    s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
    s := regexp_replace(s, '^-+|-+$', '', 'g');
    IF length(s) = 0 THEN
      s := 'org';
    END IF;
    RETURN s;
  END;
  $f$ LANGUAGE plpgsql IMMUTABLE;

  -- Création du provisioning automatique
  CREATE OR REPLACE FUNCTION public.afv_handle_new_user()
  RETURNS TRIGGER
  SECURITY DEFINER
  SET search_path = public
  AS $f$
  DECLARE
    v_org_name      TEXT;
    v_org_id        UUID;
    v_base_slug     TEXT;
    v_slug          TEXT;
    v_attempt       INT := 0;
  BEGIN
    -- Si user déjà provisionné (ex. invitation déjà appliquée), on sort
    IF EXISTS (SELECT 1 FROM public.users WHERE id = NEW.id) THEN
      RETURN NEW;
    END IF;

    v_org_name := COALESCE(
      NEW.raw_user_meta_data ->> 'organization_name',
      split_part(NEW.email, '@', 1)
    );

    v_base_slug := public.afv_slugify(v_org_name);
    v_slug := v_base_slug;
    WHILE EXISTS (SELECT 1 FROM public.organizations WHERE slug = v_slug) LOOP
      v_attempt := v_attempt + 1;
      v_slug := v_base_slug || '-' || v_attempt;
      IF v_attempt > 100 THEN
        v_slug := v_base_slug || '-' || substr(gen_random_uuid()::text, 1, 8);
        EXIT;
      END IF;
    END LOOP;

    INSERT INTO public.organizations (name, slug)
    VALUES (v_org_name, v_slug)
    RETURNING id INTO v_org_id;

    INSERT INTO public.users (id, organization_id, email, role)
    VALUES (NEW.id, v_org_id, NEW.email, 'owner');

    INSERT INTO public.wallets (organization_id, balance_fcfa)
    VALUES (v_org_id, 0);

    RETURN NEW;
  END;
  $f$ LANGUAGE plpgsql;

  DROP TRIGGER IF EXISTS afv_on_auth_user_created ON auth.users;
  CREATE TRIGGER afv_on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.afv_handle_new_user();
END $$;
