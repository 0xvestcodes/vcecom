import { use } from "react";
import { BundleEditorPanel } from "@/components/bundles/bundle-editor-panel";

interface BundleDetailPageProps {
  params: Promise<{ bundleId: string }>;
}

/**
 * Bundle detail page - Server component
 * Extracts bundleId from params and delegates to BundleEditorPanel
 */
export default function BundleDetailPage({ params }: BundleDetailPageProps) {
  const { bundleId } = use(params);
  return <BundleEditorPanel bundleId={bundleId} />;
}
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [apiError, setApiError] = useState<FetchError | null>(null);

  const { data: bundle, isLoading } = useAdminBundle(bundleId);
  const updateBundle = useAdminUpdateBundle(bundleId);
  const deleteBundle = useAdminDeleteBundle();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setError,
  } = useForm<UpdateBundleInput>();

  useEffect(() => {
    if (bundle) {
      reset({
        title: bundle.title,
        description: bundle.description,
        isActive: bundle.isActive,
      });
    }
  }, [bundle, reset]);

  const onSubmit = async (data: UpdateBundleInput) => {
    setApiError(null);
    try {
      await updateBundle.mutateAsync(data);
    } catch (error) {
      if (error instanceof Error && "errors" in error) {
        const fetchError = error as FetchError;
        setApiError(fetchError);

        if (fetchError.errors) {
          Object.entries(fetchError.errors).forEach(([field, messages]) => {
            setError(field as keyof UpdateBundleInput, {
              type: "server",
              message: Array.isArray(messages) ? messages.join(", ") : messages,
            });
          });
        }
      }
    }
  };

  const handleDelete = async () => {
    await deleteBundle.mutateAsync(bundleId);
    setDeleteDialogOpen(false);
  };

  if (isLoading) {
    return (
      <AdminPageLayout
        title="Loading..."
        description="Loading bundle details"
        breadcrumbs={[
          { label: "Bundles", href: "/bundles" },
          { label: "Loading..." },
        ]}
      >
        <div className="space-y-4">
          <div className="h-10 bg-muted animate-pulse rounded" />
          <div className="h-32 bg-muted animate-pulse rounded" />
        </div>
      </AdminPageLayout>
    );
  }

  if (!bundle) {
    return (
      <AdminPageLayout
        title="Not Found"
        description="Bundle not found"
        breadcrumbs={[
          { label: "Bundles", href: "/bundles" },
          { label: "Not Found" },
        ]}
      >
        <div className="text-center py-8">
          <p className="text-muted-foreground mb-4">Bundle not found</p>
          <Button asChild>
            <Link href="/bundles">Back to Bundles</Link>
          </Button>
        </div>
      </AdminPageLayout>
    );
  }

  return (
    <AdminPageLayout
      title={bundle.title}
      description="Edit bundle"
      breadcrumbs={[
        { label: "Bundles", href: "/bundles" },
        { label: bundle.title },
      ]}
      actions={
        <Button variant="destructive" onClick={() => setDeleteDialogOpen(true)}>
          Delete
        </Button>
      }
    >
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Bundle"
        description="Are you sure you want to delete this bundle? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteBundle.isPending}
      />

      {apiError && (
        <ErrorDisplay error={apiError} onRetry={() => setApiError(null)} />
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              {...register("title", { required: "Title is required" })}
              aria-invalid={errors.title ? "true" : "false"}
            />
            <FieldError error={errors.title?.message} />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              aria-invalid={errors.description ? "true" : "false"}
            />
            <FieldError error={errors.description?.message} />
          </div>
        </div>

        <div className="flex gap-4">
          <LoadingButton
            type="submit"
            isLoading={updateBundle.isPending}
            loadingText="Saving..."
          >
            <Save className="mr-2 h-4 w-4" />
            Save Changes
          </LoadingButton>
          <Button type="button" variant="outline" asChild>
            <Link href="/bundles">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Cancel
            </Link>
          </Button>
        </div>
      </form>
    </AdminPageLayout>
  );
}
