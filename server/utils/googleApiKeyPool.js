function createGoogleApiKeyPool(
  multipleKeysEnvName,
  singleKeyEnvName
) {
  const multipleKeys =
    process.env[multipleKeysEnvName]
      ?.split(",")
      .map((key) => key.trim())
      .filter(Boolean) ?? [];

  /*
   * Keep support for the old single-key
   * environment variable as a fallback.
   */
  const oldSingleKey =
    process.env[singleKeyEnvName]?.trim();

  const allKeys = [
    ...multipleKeys,
    ...(oldSingleKey
      ? [oldSingleKey]
      : []),
  ];

  /*
   * Remove duplicate keys.
   */
  const keys = [
    ...new Set(allKeys),
  ];

  if (keys.length === 0) {
    throw new Error(
      `No Google API keys configured for ${multipleKeysEnvName}`
    );
  }

  /*
   * The key that worked most recently.
   *
   * New requests start from this key.
   */
  let activeIndex = 0;

  function getAttemptOrder() {
    /*
     * Example:
     *
     * keys = [A, B, C]
     * activeIndex = 1
     *
     * attempt order:
     * B → C → A
     */

    return keys.map((_, offset) => {
      const index =
        (activeIndex + offset) %
        keys.length;

      return {
        key: keys[index],
        index,
      };
    });
  }

  function markSuccessful(index) {
    /*
     * If Key 2 succeeds after Key 1 fails,
     * future requests will start with Key 2.
     */
    activeIndex = index;
  }

  function getKeyCount() {
    return keys.length;
  }

  return {
    getAttemptOrder,
    markSuccessful,
    getKeyCount,
  };
}

async function runWithGoogleApiKeys(
  keyPool,
  requestFunction
) {
  const attempts =
    keyPool.getAttemptOrder();

  let lastError = null;

  for (let attemptNumber = 0;
       attemptNumber < attempts.length;
       attemptNumber += 1) {

    const {
      key,
      index,
    } = attempts[attemptNumber];

    try {
      console.log(
        `Google API attempt ${
          attemptNumber + 1
        }/${attempts.length}`
      );

      const result =
        await requestFunction(key);

      /*
       * Remember the key that worked.
       * Future requests start with it.
       */
      keyPool.markSuccessful(index);

      return result;
    } catch (error) {
      lastError = error;

      const status =
        error.response?.status;

      console.warn(
        `Google API key attempt failed`,
        {
          attempt:
            attemptNumber + 1,
          status:
            status ?? "network error",
        }
      );

      /*
       * Failures where trying another
       * configured key may help.
       */
      const googleError =
        error.response?.data?.error;

        const googleMessage =
        (
            googleError?.message ?? ""
        ).toLowerCase();

        const isApiKeyError =
        status === 400 &&
        (
            googleMessage.includes(
            "api key"
            ) ||
            googleMessage.includes(
            "key not valid"
            )
        );

        const retryWithNextKey =
        !error.response ||
        isApiKeyError ||
        status === 401 ||
        status === 403 ||
        status === 429 ||
        status === 500 ||
        status === 502 ||
        status === 503 ||
        status === 504;

      /*
       * Example:
       * 400 Bad Request means the
       * request itself is probably wrong.
       * Another key will not fix it.
       */
      if (!retryWithNextKey) {
        throw error;
      }
    }
  }

  /*
   * Every configured key failed.
   */
  throw lastError ??
    new Error(
      "All Google API keys failed"
    );
}

module.exports = {
  createGoogleApiKeyPool,
  runWithGoogleApiKeys,
};