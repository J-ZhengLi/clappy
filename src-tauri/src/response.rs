use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

static CONFIGURATION: OnceLock<Configuration> = OnceLock::new();

#[derive(Debug, Deserialize)]
pub(crate) struct Configuration {
    pub(crate) response: Response,
}

#[derive(Debug, Deserialize, Hash, PartialEq, Eq, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub(crate) enum CodeQuality {
    Perfect,
    Mediocre,
    Bad,
}

#[derive(Debug, Deserialize)]
pub(crate) struct Response(HashMap<CodeQuality, Vec<String>>);

impl Configuration {
    pub(crate) fn load() -> &'static Self {
        CONFIGURATION.get_or_init(|| {
            serde_json::from_str(include_str!("../clappy.conf.json"))
                .expect("unable to load clappy configuration")
        })
    }

    /// Return response base on rendered clippy (`cargo check`) output,
    /// including a [`CodeQuality`] to indicate how good is the code,
    /// and a random message for user.
    ///
    /// # Note
    ///
    /// The output contains multiple sections that separated by double newlines (\n\n),
    /// and the last section is the statistics, such as:
    /// ```console
    /// warning: `...` generated x warnings
    ///     Finished `...` profile ... in x.xxs
    /// ```
    /// Or
    /// ```console
    /// warning: `...` generated x warnings
    /// error: could not compile `...` due to x previous errors...
    /// ```
    ///
    /// And all sections before it are the actual rendered warning/error messages,
    /// so it might be better to just count the number of these sections to determine
    /// the code quality. (Can also try the JSON formatted output but it's too big...)
    pub(crate) fn respond_to_clippy_output(&self, output: &str) -> (CodeQuality, Option<String>) {
        let sections = output.split("\n\n");
        let defect_count = sections.count().saturating_sub(1);

        let quality = if defect_count == 0 {
            CodeQuality::Perfect
        } else if defect_count <= 5 {
            CodeQuality::Mediocre
        } else {
            CodeQuality::Bad
        };

        let message = self
            .response
            .0
            .get(&quality)
            .and_then(|list| fastrand::choice(list).cloned());

        (quality, message)
    }
}
